import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { LeasesService } from './leases.service';
import {
  CreateLeaseDto,
  UpdateLeaseDto,
  ChangeLeaseStatusDto,
  LeaseQueryDto,
  RenewLeaseDto,
} from './dto/lease.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from '@/modules/users/entities/user.entity';

@ApiTags('Leases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leases')
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new lease (contract)' })
  @ApiResponse({ status: 201, description: 'Lease created successfully' })
  @ApiResponse({ status: 400, description: 'Unit is already occupied' })
  @ApiResponse({ status: 404, description: 'Unit or tenant not found' })
  create(@Body() dto: CreateLeaseDto, @CurrentUser() user: User) {
    return this.leasesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List leases with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of leases' })
  findAll(@Query() query: LeaseQueryDto, @CurrentUser() user: User) {
    return this.leasesService.findAll(query, user);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Get active leases expiring within N days (default 30)' })
  @ApiResponse({ status: 200, description: 'List of expiring leases ordered by end date' })
  getExpiring(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @CurrentUser() user: User,
  ) {
    return this.leasesService.getExpiring(days, user);
  }

  @Post(':id/renew')
  @ApiOperation({ summary: 'Renew an active or expired lease with a new end date' })
  @ApiParam({ name: 'id', description: 'Lease UUID' })
  @ApiResponse({ status: 200, description: 'Lease renewed successfully' })
  @ApiResponse({ status: 400, description: 'Lease cannot be renewed or new date is invalid' })
  @ApiResponse({ status: 404, description: 'Lease not found' })
  renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewLeaseDto,
    @CurrentUser() user: User,
  ) {
    return this.leasesService.renew(id, dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single lease with payments' })
  @ApiParam({ name: 'id', description: 'Lease UUID' })
  @ApiResponse({ status: 200, description: 'Lease details with payment history' })
  @ApiResponse({ status: 404, description: 'Lease not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.leasesService.findOne(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a lease' })
  @ApiParam({ name: 'id', description: 'Lease UUID' })
  @ApiResponse({ status: 200, description: 'Lease updated successfully' })
  @ApiResponse({ status: 404, description: 'Lease not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaseDto,
    @CurrentUser() user: User,
  ) {
    return this.leasesService.update(id, dto, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change lease status (activate, terminate, expire)' })
  @ApiParam({ name: 'id', description: 'Lease UUID' })
  @ApiResponse({ status: 200, description: 'Status changed. Unit status updated automatically.' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeLeaseStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.leasesService.changeStatus(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lease' })
  @ApiParam({ name: 'id', description: 'Lease UUID' })
  @ApiResponse({ status: 204, description: 'Lease deleted. Unit status updated automatically.' })
  @ApiResponse({ status: 404, description: 'Lease not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.leasesService.remove(id, user);
  }
}
