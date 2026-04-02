# Scheduler Integration Examples

Real-world usage patterns for the task scheduler and heartbeat system.

## Table of Contents

1. [Research Cycle Automation](#research-cycle-automation)
2. [Report Generation Pipeline](#report-generation-pipeline)
3. [Health Monitoring & Recovery](#health-monitoring--recovery)
4. [Campaign Management](#campaign-management)
5. [Analytics & Metrics](#analytics--metrics)

## Research Cycle Automation

### Automated Daily Research

Schedule daily research to run before business hours and generate reports.

```typescript
import { scheduler } from '@/utils/scheduler';
import { useOrchestratedResearch } from '@/hooks/useOrchestratedResearch';

// Register the research executor
scheduler.registerExecutor('research', async (params: any) => {
  const { depth = 'NR', campaignId, mode = 'full' } = params;

  // Call the research orchestration hook
  const result = await orchestrateResearch({
    campaignId,
    depth,
    mode,
  });

  return {
    success: result.status === 'complete',
    cycleId: result.cycleId,
    timestamp: Date.now(),
  };
});

// Create daily research task (9am weekdays)
const dailyTask = scheduler.createTask(
  'Daily Market Research',
  'research',
  'recurring',
  {
    depth: 'NR', // Normal depth
    campaignId: 'camp-skincare-001',
    mode: 'full',
  },
  {
    cron: '0 9 * * 1-5', // 9am Monday-Friday
    maxRetries: 2,
    timeout: 600000, // 10 minutes
    description: 'Daily research for skincare campaign'
  }
);

// Also create a quick research for afternoons
const afternoonTask = scheduler.createTask(
  'Quick Afternoon Research',
  'research',
  'recurring',
  {
    depth: 'QK', // Quick
    campaignId: 'camp-skincare-001',
  },
  {
    cron: '0 14 * * 1-5', // 2pm Monday-Friday
    maxRetries: 1,
    timeout: 300000, // 5 minutes
  }
);
```

### Campaign-Specific Research Schedule

Different campaigns, different schedules.

```typescript
// Configuration for multiple campaigns
const campaignSchedules = [
  {
    campaignId: 'camp-skincare-001',
    name: 'Skincare Campaign',
    schedules: [
      { cron: '0 9 * * *', depth: 'NR', description: 'Daily normal research' },
      { cron: '0 0 * * 0', depth: 'EX', description: 'Weekly extended research' },
    ],
  },
  {
    campaignId: 'camp-supplements-001',
    name: 'Supplements Campaign',
    schedules: [
      { cron: '0 8 * * 1-5', depth: 'QK', description: 'Quick weekday morning' },
      { cron: '0 0 1 * *', depth: 'MX', depth: 'MX', description: 'Monthly deep dive' },
    ],
  },
];

// Create all schedules
for (const campaign of campaignSchedules) {
  for (const schedule of campaign.schedules) {
    await scheduler.createTask(
      `${campaign.name} — ${schedule.description}`,
      'research',
      'recurring',
      {
        campaignId: campaign.campaignId,
        depth: schedule.depth,
      },
      {
        cron: schedule.cron,
        description: schedule.description,
      }
    );
  }
}
```

## Report Generation Pipeline

### Weekly Performance Report

Automated report generation with email notifications.

```typescript
import { storage } from '@/utils/storage';

scheduler.registerExecutor('report', async (params: any) => {
  const {
    campaignId,
    format = 'pdf',
    email,
    metrics = ['conversions', 'engagement', 'ctr'],
  } = params;

  // Fetch campaign data
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

  // Generate report
  const reportData = {
    timestamp: Date.now(),
    campaign: {
      id: campaign.id,
      brand: campaign.brand,
      targetAudience: campaign.targetAudience,
    },
    metrics: metrics.map(m => ({
      name: m,
      value: Math.random() * 100, // Placeholder
    })),
  };

  // Format for delivery
  const output = format === 'pdf'
    ? generatePDFReport(reportData)
    : generateCSVReport(reportData);

  // Send if email provided
  if (email) {
    await sendReportEmail(email, output);
  }

  return {
    success: true,
    reportId: `report-${Date.now()}`,
    format,
    sentTo: email,
  };
});

// Weekly report - Friday 5pm
const weeklyReport = scheduler.createTask(
  'Weekly Performance Report',
  'report',
  'recurring',
  {
    campaignId: 'camp-skincare-001',
    format: 'pdf',
    email: 'marketing@company.com',
    metrics: ['conversions', 'engagement', 'ctr', 'cost_per_lead'],
  },
  {
    cron: '0 17 * * 5', // Friday 5pm
    timeout: 120000,
    description: 'Weekly metrics report'
  }
);

// Monthly comprehensive report - first of month
const monthlyReport = scheduler.createTask(
  'Monthly Comprehensive Report',
  'report',
  'recurring',
  {
    campaignId: 'camp-skincare-001',
    format: 'pdf',
    email: 'leadership@company.com',
    metrics: ['all'],
  },
  {
    cron: '0 9 1 * *', // First day of month, 9am
    timeout: 300000,
    description: 'Full month analysis'
  }
);
```

### Batch Report Generation

Generate reports for multiple campaigns.

```typescript
const reportConfig = {
  campaigns: [
    { id: 'camp-001', name: 'Campaign A', email: 'team-a@company.com' },
    { id: 'camp-002', name: 'Campaign B', email: 'team-b@company.com' },
    { id: 'camp-003', name: 'Campaign C', email: 'team-c@company.com' },
  ],
  schedule: '0 18 * * 1-5', // Daily at 6pm weekdays
  format: 'pdf',
};

// Create task for each campaign
for (const campaign of reportConfig.campaigns) {
  await scheduler.createTask(
    `Daily Report — ${campaign.name}`,
    'report',
    'recurring',
    {
      campaignId: campaign.id,
      format: reportConfig.format,
      email: campaign.email,
    },
    {
      cron: reportConfig.schedule,
      timeout: 60000,
    }
  );
}
```

## Health Monitoring & Recovery

### Service Health Dashboard

Real-time monitoring with auto-recovery.

```typescript
import { heartbeatMonitor } from '@/utils/heartbeatMonitor';

// Configure aggressive monitoring for critical services
heartbeatMonitor.setConfig({
  checkIntervalMs: 15000, // Check every 15 seconds
  autoRecoveryEnabled: true,
  degradedThreshold: 2, // 2 failures = degraded
  downThreshold: 4, // 4 failures = down
  archiveRetentionDays: 90,
  alertLevelConfig: {
    ollama: 'critical',
    wayfarer: 'critical',
    searxng: 'warning',
  },
});

// Listen to all status changes
heartbeatMonitor.onStatusChange((alert) => {
  console.log(`[Alert] ${alert.service}: ${alert.message}`);

  if (alert.level === 'critical') {
    // Trigger notifications
    notifyOps(`Critical service issue: ${alert.service}`, {
      timestamp: alert.timestamp,
      service: alert.service,
      previousStatus: alert.previousStatus,
      newStatus: alert.newStatus,
    });
  }

  if (alert.newStatus === 'healthy' && alert.previousStatus !== 'unknown') {
    // Service recovered
    notifyOps(`Service recovered: ${alert.service}`, { recovered: true });
  }
});

// Scheduled health check reports
scheduler.registerExecutor('healthcheck', async () => {
  const report = await heartbeatMonitor.getHealthReport();

  return {
    timestamp: report.timestamp,
    overallHealth: report.overallHealth,
    services: report.services.map(s => ({
      name: s.name,
      status: s.status,
      latency: s.latencyMs,
    })),
    stats: report.stats,
  };
});

// Daily health check report - 8am
const dailyHealthCheck = scheduler.createTask(
  'Daily Health Check Report',
  'healthcheck',
  'recurring',
  {},
  {
    cron: '0 8 * * *',
    timeout: 30000,
    description: 'Daily service health verification'
  }
);
```

### Conditional Task Execution

Only run research if services are healthy.

```typescript
import { useScheduler } from '@/hooks/useScheduler';
import { useHeartbeat } from '@/hooks/useHeartbeat';

function CampaignOrchestrator() {
  const { createTask } = useScheduler();
  const { snapshot } = useHeartbeat();

  const scheduleConditional = async () => {
    // Check if all services are healthy
    const allHealthy = snapshot &&
      Object.values(snapshot).every(s => s.status === 'healthy');

    if (allHealthy) {
      await createTask(
        'Safe Research Execution',
        'research',
        'recurring',
        { depth: 'EX', campaignId: 'camp-001' },
        { cron: '0 9 * * *' }
      );
    } else {
      // Queue less demanding task
      await createTask(
        'Light Research Execution',
        'research',
        'recurring',
        { depth: 'QK', campaignId: 'camp-001' },
        { cron: '0 10 * * *' }
      );
    }
  };

  return (
    <button onClick={scheduleConditional}>
      Schedule Research (Health-Aware)
    </button>
  );
}
```

## Campaign Management

### Campaign Lifecycle Events

Automate actions based on campaign milestones.

```typescript
// When campaign created
async function onCampaignCreated(campaign: Campaign) {
  const campaignId = campaign.id;

  // Start research cycle
  await scheduler.createTask(
    `Research — ${campaign.brand}`,
    'research',
    'recurring',
    {
      campaignId,
      depth: 'NR',
    },
    {
      cron: '0 9 * * *', // Daily 9am
      timeout: 600000,
    }
  );

  // Start weekly reports
  await scheduler.createTask(
    `Report — ${campaign.brand}`,
    'report',
    'recurring',
    {
      campaignId,
      format: 'pdf',
      email: campaign.ownerEmail,
    },
    {
      cron: '0 17 * * 5', // Friday 5pm
      timeout: 120000,
    }
  );

  // Daily health check
  await scheduler.createTask(
    `Health Check — ${campaign.brand}`,
    'healthcheck',
    'recurring',
    { campaignId },
    {
      cron: '0 8 * * *', // Daily 8am
      timeout: 30000,
    }
  );
}

// When campaign archived
async function onCampaignArchived(campaignId: string) {
  const tasks = scheduler.getAllTasks()
    .filter(t => t.parameters?.campaignId === campaignId);

  for (const task of tasks) {
    await scheduler.pauseTask(task.id); // Pause instead of delete
  }
}
```

### Batch Campaign Setup

Quickly configure multiple campaigns with consistent schedules.

```typescript
async function setupCampaignAutomation(campaigns: Campaign[]) {
  for (const campaign of campaigns) {
    // Research schedule
    await scheduler.createTask(
      `${campaign.brand} — Research`,
      'research',
      'recurring',
      {
        campaignId: campaign.id,
        depth: 'NR',
      },
      { cron: '0 9 * * 1-5' } // Weekdays 9am
    );

    // Weekly report
    await scheduler.createTask(
      `${campaign.brand} — Weekly Report`,
      'report',
      'recurring',
      {
        campaignId: campaign.id,
        format: 'pdf',
        email: campaign.ownerEmail,
      },
      { cron: '0 17 * * 5' } // Friday 5pm
    );

    // Monthly deep dive
    await scheduler.createTask(
      `${campaign.brand} — Monthly Deep Research`,
      'research',
      'recurring',
      {
        campaignId: campaign.id,
        depth: 'MX', // Maximum depth
      },
      { cron: '0 9 1 * *' } // First of month 9am
    );
  }

  return campaigns.length;
}
```

## Analytics & Metrics

### Monitoring Scheduler Health

Track scheduler performance.

```typescript
import { scheduler } from '@/utils/scheduler';

function SchedulerHealthPanel() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const m = scheduler.getMetrics();
      setMetrics(m);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  if (!metrics) return <div>Loading...</div>;

  return (
    <div className="p-4 bg-white rounded-lg">
      <h3 className="text-lg font-bold mb-4">Scheduler Health</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-gray-600">Total Tasks</p>
          <p className="text-2xl font-bold">{metrics.totalTasks}</p>
        </div>
        <div>
          <p className="text-gray-600">Active Tasks</p>
          <p className="text-2xl font-bold">{metrics.activeTasks}</p>
        </div>
        <div>
          <p className="text-gray-600">Success Rate</p>
          <p className="text-2xl font-bold">
            {(100 - metrics.failureRate).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-gray-600">Avg Duration</p>
          <p className="text-2xl font-bold">{metrics.avgExecutionTime}ms</p>
        </div>
      </div>
    </div>
  );
}
```

### Execution Analytics

Analyze task execution patterns.

```typescript
function ExecutionAnalytics() {
  const { executions } = useScheduler();

  // Success rate over time
  const successRate = executions.filter(e => e.status === 'completed').length /
    executions.length * 100;

  // Average duration by hour
  const durationByHour = executions.reduce((acc, e) => {
    const hour = new Date(e.startedAt).getHours();
    if (!acc[hour]) acc[hour] = [];
    acc[hour].push(e.duration);
    return acc;
  }, {} as Record<number, number[]>);

  const avgByHour = Object.fromEntries(
    Object.entries(durationByHour).map(([hour, durations]) => [
      hour,
      durations.reduce((a, b) => a + b, 0) / durations.length,
    ])
  );

  // Failure analysis
  const failures = executions.filter(e => e.status === 'failed');
  const failureReasons = failures.reduce((acc, f) => {
    const reason = f.error?.split(':')[0] || 'unknown';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded">
        <p className="text-sm text-gray-600">Success Rate</p>
        <p className="text-3xl font-bold">{successRate.toFixed(1)}%</p>
      </div>

      <div className="bg-green-50 p-4 rounded">
        <p className="text-sm text-gray-600">Total Executions</p>
        <p className="text-3xl font-bold">{executions.length}</p>
      </div>

      {Object.keys(failureReasons).length > 0 && (
        <div className="bg-red-50 p-4 rounded">
          <p className="text-sm text-gray-600 mb-2">Top Failure Reasons</p>
          {Object.entries(failureReasons)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([reason, count]) => (
              <p key={reason} className="text-sm">
                {reason}: {count}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
```

---

These examples demonstrate how to integrate the scheduler and heartbeat system into your Ad Agent workflow for production-grade automation and monitoring.
