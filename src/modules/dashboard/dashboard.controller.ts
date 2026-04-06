import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from '@/modules/users/entities/user.entity';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all key metrics in a single call',
    description:
      'Returns: property/unit counts, occupancy rate, current-month income summary, ' +
      'upcoming lease expirations (30 days), open maintenance by priority, ' +
      'and top 5 tenants with overdue payments.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard metrics for the authenticated user' })
  getDashboard(@CurrentUser() user: User) {
    return this.dashboardService.getDashboard(user);
  }
}
