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
import { MaintenanceService } from './maintenance.service';
import {
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  ChangeMaintenanceStatusDto,
  MaintenanceQueryDto,
} from './dto/maintenance.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from '@/modules/users/entities/user.entity';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new maintenance request' })
  @ApiResponse({ status: 201, description: 'Maintenance request created successfully' })
  @ApiResponse({ status: 404, description: 'Unit or tenant not found' })
  create(@Body() dto: CreateMaintenanceDto, @CurrentUser() user: User) {
    return this.maintenanceService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List maintenance requests with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of maintenance requests' })
  findAll(@Query() query: MaintenanceQueryDto, @CurrentUser() user: User) {
    return this.maintenanceService.findAll(query, user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get maintenance statistics (by status, by priority, costs)' })
  @ApiResponse({ status: 200, description: 'Maintenance stats grouped by status and priority' })
  getMaintenanceStats(@CurrentUser() user: User) {
    return this.maintenanceService.getMaintenanceStats(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single maintenance request with unit and tenant details' })
  @ApiParam({ name: 'id', description: 'MaintenanceRequest UUID' })
  @ApiResponse({ status: 200, description: 'Maintenance request details' })
  @ApiResponse({ status: 404, description: 'Maintenance request not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.maintenanceService.findOne(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a maintenance request' })
  @ApiParam({ name: 'id', description: 'MaintenanceRequest UUID' })
  @ApiResponse({ status: 200, description: 'Maintenance request updated successfully' })
  @ApiResponse({ status: 404, description: 'Maintenance request not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenanceDto,
    @CurrentUser() user: User,
  ) {
    return this.maintenanceService.update(id, dto, user);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Change maintenance request status',
    description:
      'Valid transitions: open → in_progress | cancelled, in_progress → completed | cancelled. ' +
      'completed and cancelled are terminal states. completedAt is set automatically when status = completed.',
  })
  @ApiParam({ name: 'id', description: 'MaintenanceRequest UUID' })
  @ApiResponse({ status: 200, description: 'Status changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeMaintenanceStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.maintenanceService.changeStatus(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a maintenance request' })
  @ApiParam({ name: 'id', description: 'MaintenanceRequest UUID' })
  @ApiResponse({ status: 204, description: 'Maintenance request deleted' })
  @ApiResponse({ status: 404, description: 'Maintenance request not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.maintenanceService.remove(id, user);
  }
}
