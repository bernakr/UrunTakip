import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthService, HealthView } from "./health.service";

@Controller("health")
@ApiTags("Health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): Promise<HealthView> {
    return this.healthService.getHealth();
  }
}
