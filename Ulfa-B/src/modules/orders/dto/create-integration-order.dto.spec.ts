import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateIntegrationOrderDto } from './create-integration-order.dto';
import { CreateMerchantOrderDto } from './create-merchant-order.dto';

const body = (customerPhone: string) => ({
  customerName: 'Sara',
  customerPhone,
  externalOrderId: 'UL-1047',
  items: [{ productName: 'Gold necklace' }],
});

const phoneErrors = (cls: new () => object, phone: string) =>
  validateSync(plainToInstance(cls, body(phone))).filter(
    (error) => error.property === 'customerPhone',
  );

describe('order phone rules', () => {
  it('accepts international numbers from integrations', () => {
    expect(phoneErrors(CreateIntegrationOrderDto, '+49 170 123 4567')).toEqual(
      [],
    );
    expect(phoneErrors(CreateIntegrationOrderDto, '+970591234567')).toEqual([]);
  });

  it('rejects malformed numbers from integrations', () => {
    expect(phoneErrors(CreateIntegrationOrderDto, '0591234567')).toHaveLength(1);
    expect(phoneErrors(CreateIntegrationOrderDto, '+0123')).toHaveLength(1);
  });

  it('keeps the merchant portal limited to local numbers', () => {
    expect(phoneErrors(CreateMerchantOrderDto, '+491701234567')).toHaveLength(1);
    expect(phoneErrors(CreateMerchantOrderDto, '+970591234567')).toEqual([]);
  });
});
