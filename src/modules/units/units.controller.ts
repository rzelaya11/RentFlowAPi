import {
  Controller,
  Get,
  Post,
  Put,
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
import { UnitsService } from './units.service';
import { CreateUnitDto, UpdateUnitDto, UnitQueryDto } from './dto/unit.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from '@/modules/users/entities/user.entity';

@ApiTags('Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiParam({ name: 'propertyId', description: 'Property UUID' })
@Controller('properties/:propertyId/units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new unit within a property' })
  @ApiResponse({ status: 201, description: 'Unit created successfully' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  @ApiResponse({ status: 403, description: 'Property does not belong to user' })
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateUnitDto,
    @CurrentUser() user: User,
  ) {
    return this.unitsService.create({ ...dto, propertyId }, user);
  }

  @Get()
  @ApiOperation({ summary: 'List units for a property with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of units' })
  findAll(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: UnitQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.unitsService.findAll({ ...query, propertyId }, user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get unit statistics for the property' })
  @ApiResponse({ status: 200, description: 'Unit statistics' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  getStatsByProperty(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: User,
  ) {
    return this.unitsService.getStatsByProperty(propertyId, user);
  }

  @Get('available')
  @ApiOperation({ summary: 'List available units for a property (for lease creation form)' })
  @ApiResponse({ status: 200, description: 'Available units' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  findAvailable(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: User,
  ) {
    return this.unitsService.findAvailable(propertyId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single unit with lease history' })
  @ApiParam({ name: 'id', description: 'Unit UUID' })
  @ApiResponse({ status: 200, description: 'Unit details' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  findOne(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.unitsService.findOne(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a unit' })
  @ApiParam({ name: 'id', description: 'Unit UUID' })
  @ApiResponse({ status: 200, description: 'Unit updated successfully' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() user: User,
  ) {
    return this.unitsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a unit' })
  @ApiParam({ name: 'id', description: 'Unit UUID' })
  @ApiResponse({ status: 204, description: 'Unit deleted' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  remove(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.unitsService.remove(id, user);
  }
}
