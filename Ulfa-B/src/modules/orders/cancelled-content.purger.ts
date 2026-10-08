import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, IsNull, LessThan } from 'typeorm';
import { ItemContent } from '../nfc-items/entities/item-content.entity';
import { ItemMedia } from '../nfc-items/entities/item-media.entity';
import { NfcItem } from '../nfc-items/entities/nfc-item.entity';
import { StorageService } from '../storage/storage.service';
import { Order, OrderStatus } from './entities/order.entity';

const DEFAULT_RETENTION_HOURS = 72;

/** CANCELLED_CONTENT_RETENTION_HOURS, or 72 when unset or invalid. */
export const retentionHoursFrom = (config: ConfigService): number => {
  const value = Number(config.get<string>('CANCELLED_CONTENT_RETENTION_HOURS'));
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_RETENTION_HOURS;
};
const RUN_EVERY_MS = 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;
const BATCH = 25;

/**
 * Deletes what buyers uploaded to cancelled orders once the retention window
 * (CANCELLED_CONTENT_RETENTION_HOURS, 72 by default) has passed: photos,
 * videos and recordings in storage, their rows, the letter, and the item's
 * secrets. The order and its items stay for the merchant's records.
 *
 * Runs hourly inside the API process. Each order is stamped only after its
 * files are gone, so a failed run is simply retried on the next one.
 */
@Injectable()
export class CancelledContentPurger
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CancelledContentPurger.name);
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  get retentionHours(): number {
    return retentionHoursFrom(this.config);
  }

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    const run = () => void this.run();
    const first = setTimeout(run, FIRST_RUN_DELAY_MS);
    const every = setInterval(run, RUN_EVERY_MS);
    first.unref();
    every.unref();
    this.timers = [first, every];
  }

  onModuleDestroy() {
    this.timers.forEach((timer) => clearTimeout(timer));
  }

  /** Purges every due order, a batch at a time. Returns how many were purged. */
  async run(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let purged = 0;
    try {
      const cutoff = new Date(now.getTime() - this.retentionHours * 3_600_000);
      for (;;) {
        const due = await this.dataSource.getRepository(Order).find({
          where: {
            status: OrderStatus.CANCELLED,
            cancelledAt: LessThan(cutoff),
            contentPurgedAt: IsNull(),
          },
          order: { cancelledAt: 'ASC' },
          take: BATCH,
        });
        if (!due.length) break;
        for (const order of due) {
          await this.purge(order);
          purged += 1;
        }
        if (due.length < BATCH) break;
      }
    } catch (error) {
      this.logger.error(
        'Purging cancelled orders failed; retrying next run',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
    if (purged)
      this.logger.log(`Purged content of ${purged} cancelled order(s)`);
    return purged;
  }

  private async purge(order: Order) {
    const current = await this.dataSource
      .getRepository(Order)
      .findOne({ where: { id: order.id } });
    if (
      !current ||
      current.status !== OrderStatus.CANCELLED ||
      !current.cancelledAt ||
      current.contentPurgedAt
    ) {
      // Restored (or already purged) since it was picked. Restoring is refused
      // once the window has passed, so the two cannot overlap.
      return;
    }
    const items = await this.dataSource.getRepository(NfcItem).find({
      where: { order: { id: order.id } },
      select: { id: true },
    });
    const itemIds = items.map((item) => item.id);

    if (itemIds.length) {
      const media = await this.dataSource
        .getRepository(ItemMedia)
        .findBy({ itemId: In(itemIds) });
      // Files first: rows are removed only once storage confirms.
      await this.storage.deleteMany(
        media.flatMap((m) => [m.storageKey, m.thumbKey] as string[]),
      );
      await this.dataSource.transaction(async (manager) => {
        if (media.length) {
          await manager.delete(ItemMedia, { id: In(media.map((m) => m.id)) });
        }
        await manager.delete(ItemContent, { itemId: In(itemIds) });
        await manager.update(
          NfcItem,
          { id: In(itemIds) },
          {
            viewerAuthPrompt: null as unknown as string,
            viewerPasswordHash: null as unknown as string,
            creatorPasswordHash: null as unknown as string,
            wrappedKey: null,
            recoveryWrappedKey: null,
            recoveryHash: null,
          },
        );
        await manager.update(
          Order,
          { id: order.id },
          { contentPurgedAt: new Date() },
        );
      });
    } else {
      await this.dataSource
        .getRepository(Order)
        .update({ id: order.id }, { contentPurgedAt: new Date() });
    }
  }
}
