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
} from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyQueryDto,
} from './dto/property.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from '@/modules/users/entities/user.entity';

@ApiTags('Properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new property' })
  @ApiResponse({ status: 201, description: 'Property created successfully' })
  create(@Body() dto: CreatePropertyDto, @CurrentUser() user: User) {
    return this.propertiesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List all properties with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of properties' })
  findAll(@Query() query: PropertyQueryDto, @CurrentUser() user: User) {
    return this.propertiesService.findAll(query, user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get property statistics for dashboard' })
  @ApiResponse({ status: 200, description: 'Property statistics' })
  getStats(@CurrentUser() user: User) {
    return this.propertiesService.getStats(user);
  }

  @Get('available')
  @ApiOperation({ summary: 'List properties that have at least one available unit (for lease creation form)' })
  @ApiResponse({ status: 200, description: 'Properties with available units' })
  findAvailable(@CurrentUser() user: User) {
    return this.propertiesService.findAvailable(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single property with units' })
  @ApiResponse({ status: 200, description: 'Property details' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.propertiesService.findOne(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a property' })
  @ApiResponse({ status: 200, description: 'Property updated successfully' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: User,
  ) {
    return this.propertiesService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a property' })
  @ApiResponse({ status: 204, description: 'Property deleted' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.propertiesService.remove(id, user);
  }
}
