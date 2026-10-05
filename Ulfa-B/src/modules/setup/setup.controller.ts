import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ContentDto,
  CreateMediaDto,
  LockDto,
  MediaOrderDto,
  RecoverDto,
  SectionsDto,
  SessionDto,
  SettingsDto,
  UpdateMediaDto,
} from './dto/setup.dto';
import {
  readSetupSession,
  SetupSessionGuard,
  type SetupRequest,
} from './setup-session.guard';
import { SetupService } from './setup.service';

/** Buyer-facing setup, addressed by the item's edit token (the setup link). */
@Controller('setup/:token')
export class SetupController {
  constructor(
    private readonly setup: SetupService,
    private readonly jwt: JwtService,
  ) {}

  @Get()
  state(@Param('token', ParseUUIDPipe) token: string) {
    return this.setup.getState(token);
  }

  @Put('lock')
  lock(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: LockDto,
    @Req() req: SetupRequest,
  ) {
    return this.setup.lock(token, dto, readSetupSession(this.jwt, req));
  }

  @Post('session')
  @HttpCode(HttpStatus.OK)
  session(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: SessionDto,
  ) {
    return this.setup.openSession(token, dto.authKey);
  }

  @Post('recover')
  @HttpCode(HttpStatus.OK)
  recover(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: RecoverDto,
  ) {
    return this.setup.recover(token, dto.recoveryAuthKey);
  }

  @Get('draft')
  @UseGuards(SetupSessionGuard)
  draft(@Param('token', ParseUUIDPipe) token: string) {
    return this.setup.draft(token);
  }

  @Patch('settings')
  @UseGuards(SetupSessionGuard)
  settings(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: SettingsDto,
  ) {
    return this.setup.updateSettings(token, dto);
  }

  @Put('sections')
  @UseGuards(SetupSessionGuard)
  sections(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: SectionsDto,
  ) {
    return this.setup.updateSections(token, dto);
  }

  @Put('content')
  @UseGuards(SetupSessionGuard)
  content(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: ContentDto,
  ) {
    return this.setup.updateContent(token, dto);
  }

  @Post('media')
  @UseGuards(SetupSessionGuard)
  createMedia(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: CreateMediaDto,
  ) {
    return this.setup.createMedia(token, dto);
  }

  // Declared before media/:id so "order" is not read as an id.
  @Put('media/order')
  @UseGuards(SetupSessionGuard)
  reorder(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: MediaOrderDto,
  ) {
    return this.setup.reorderMedia(token, dto);
  }

  @Post('media/:id/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SetupSessionGuard)
  complete(
    @Param('token', ParseUUIDPipe) token: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.setup.completeMedia(token, id);
  }

  @Patch('media/:id')
  @UseGuards(SetupSessionGuard)
  updateMedia(
    @Param('token', ParseUUIDPipe) token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.setup.updateMedia(token, id, dto);
  }

  @Delete('media/:id')
  @UseGuards(SetupSessionGuard)
  deleteMedia(
    @Param('token', ParseUUIDPipe) token: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.setup.deleteMedia(token, id);
  }

  @Post('publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SetupSessionGuard)
  publish(@Param('token', ParseUUIDPipe) token: string) {
    return this.setup.publish(token);
  }
}
