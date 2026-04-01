# SaaS Requirements for Neuro (Ad Agent)

## 1. Overview

This document outlines the account management, SaaS features, and business model requirements for **Neuro**, the AI-driven creative advertising agent. The system needs to support flexible subscription tiers, usage-based quotas, and team collaboration while maintaining scalability for both cloud-hosted and self-hosted deployments.

---

## 2. Account Management

### 2.1 User Registration & Authentication

**Requirements:**
- Email/password registration with validation
- OAuth 2.0 integration (Google, GitHub, Apple optional)
- Email verification before account activation
- Password reset flow with secure token
- Two-factor authentication (2FA) option for premium tiers

**Technical Implementation:**
```typescript
interface UserAccount {
  id: string;
  email: string;
  passwordHash: string; // bcrypt or argon2
  emailVerified: boolean;
  emailVerificationToken?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  createdAt: Date;
  lastLoginAt: Date;
}
```

**Storage:** IndexedDB (client) + Server database (PostgreSQL/MongoDB for cloud)

---

### 2.2 User Profile & Customization

**Profile Information:**
- Name, avatar/photo
- Bio, company, industry
- Creative preferences (brand guidelines, style notes)
- API key management for personal use
- Notification preferences

**Brand DNA Storage:**
- Customer desires mapping
- Objection patterns observed
- Preferred audience segments
- Approved design tokens (colors, fonts)
- Historical campaigns metadata

**Data Model:**
```typescript
interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  company?: string;
  industry?: string;
  bio?: string;
  brandDnaPreferences: {
    colorPalette?: string[];
    fontPreferences?: string[];
    toneOfVoice?: string;
    targetAudienceNotes?: string;
  };
  apiKeys: Array<{
    id: string;
    name: string;
    key: string;
    createdAt: Date;
    lastUsed?: Date;
    revokedAt?: Date;
  }>;
  notificationSettings: {
    emailOnCycleComplete?: boolean;
    emailOnErrors?: boolean;
    slackNotifications?: boolean;
    slackWebhookUrl?: string;
  };
  updatedAt: Date;
}
```

---

### 2.3 Password Security & Account Recovery

**Password Requirements:**
- Minimum 12 characters (or configurable)
- Support for passphrases
- Password history (prevent reuse within 5 previous)
- Expiration optional (90 days for enterprise)

**Account Recovery:**
- Multi-step email-based recovery
- Backup codes (10x one-time use codes during setup)
- Account lockout after 5 failed login attempts (15-minute cooldown)
- Security questions as secondary verification

---

### 2.4 Account Deletion

**Process:**
1. User requests deletion from settings
2. Confirmation email sent (24-hour grace period)
3. All campaign data, conversations, and memories deleted
4. Stripe customer record marked for deletion
5. Audit log entry created

**Data Retention:**
- Aggregated usage metrics retained (anonymized)
- Payment history retained per legal requirements (7 years for US)
- Deleted account ID logged but personally identifiable information redacted

---

### 2.5 Team & Organization Management

**Features:**
- Invite team members via email
- Role-based access control (Owner, Admin, Member, Viewer)
- Organization-level billing
- Shared campaign templates
- Shared research findings and insights
- Audit trail of actions per user

**Data Model:**
```typescript
interface Organization {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  subscriptionTierId: string;
  members: Array<{
    userId: string;
    email: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    invitedAt: Date;
    joinedAt?: Date;
    removedAt?: Date;
  }>;
  sharedResources: {
    campaignTemplates: string[]; // campaign IDs
    researchLibrary: string[]; // research findings IDs
  };
}

interface AuditLog {
  id: string;
  organizationId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, any>;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
}
```

---

## 3. Subscription Tiers

### 3.1 Pricing Structure

**Three-Tier Model:**

| **Feature** | **Starter** | **Pro** | **Max** |
|---|---|---|---|
| **Monthly Cost** | $99 | $299 | $999 |
| **Billing** | Monthly/Annual | Monthly/Annual | Monthly/Annual |
| **Campaigns/Month** | 5 | 20 | Unlimited |
| **Messages/Month** | 1000 | 5000 | Unlimited |
| **Research Depth** | SQ/QK | SQ/QK/NR | SQ/QK/NR/EX/MX |
| **Model Tier Access** | Light/Standard | Standard/Quality | Light/Standard/Quality/Maximum |
| **Team Members** | 1 | 5 | Unlimited |
| **Chat History** | 30 days | 90 days | Unlimited |
| **API Access** | No | Read-only | Full |
| **Custom Integrations** | No | No | Yes |
| **Priority Support** | No | Email | Email + Slack |
| **SLA** | Best effort | 99.5% | 99.9% |

---

### 3.2 Research Depth Tiers (Feature Unlock)

Research depth presets map directly to subscription tier:

**Starter** → SQ (Super Quick) + QK (Quick)
- 5–30 min per cycle
- 8–25 sources
- Basic desire analysis

**Pro** → SQ + QK + NR (Normal)
- 5–90 min per cycle
- 8–75 sources
- Desire analysis + competitor landscape
- Community sentiment integration (optional add-on: +$50/month)

**Max** → All presets (SQ/QK/NR/EX/MX)
- Up to 5 hours per cycle
- Up to 400 sources
- All research features unlocked
- Visual scouting (Wayfarer Plus) included
- Ad-scraping and competitor visual analysis

---

### 3.3 Model Tier Access

**Light** (Starter default)
- qwen3.5:0.8b, qwen3.5:2b
- Fast, low VRAM footprint
- Best for quick iterations

**Standard** (Pro default)
- qwen3.5:2b, qwen3.5:4b
- Balanced quality & speed
- Good for most users

**Quality** (Pro add-on: +$100/month)
- qwen3.5:4b, qwen3.5:9b
- Higher output quality
- Deeper reasoning

**Maximum** (Max default)
- qwen3.5:9b, qwen3.5:27b, gpt-oss-20b
- Best creative output
- Maximum reasoning depth

---

## 4. Usage Quotas & Rate Limiting

### 4.1 Quota Enforcement

**Starter:**
- 5 campaigns/month (hard limit)
- 1000 messages/month (soft limit: alert at 80%, blocks at 100%)
- 10 research cycles/month
- 2 concurrent cycles (queued after)

**Pro:**
- 20 campaigns/month
- 5000 messages/month
- 50 research cycles/month
- 3 concurrent cycles

**Max:**
- Unlimited campaigns
- Unlimited messages
- Unlimited cycles
- 5 concurrent cycles

**Quota Tracking:**
```typescript
interface UsageQuota {
  userId: string;
  month: string; // YYYY-MM format
  campaignsUsed: number;
  messagesUsed: number;
  researchCyclesUsed: number;
  apiCallsUsed: number;
  storageUsedMB: number;
  resetDate: Date;
  alertsSent: string[]; // alert IDs
}
```

---

### 4.2 Rate Limiting

**Per User (across all tiers):**
- 100 requests/min to API
- 10 concurrent research cycles max
- 5 message submissions/sec

**Per Organization:**
- 500 requests/min total
- 30 concurrent cycles total

**Backpressure Strategy:**
- Return 429 (Too Many Requests) with Retry-After header
- Client-side exponential backoff with jitter
- Queue management for research cycles (max 100 queued)

---

### 4.3 Storage Quotas

| **Tier** | **Campaigns** | **Research Data** | **Chat History** | **Attachments** |
|---|---|---|---|---|
| **Starter** | 500 MB | 1 GB | 30 days | 10 GB/month |
| **Pro** | 2 GB | 5 GB | 90 days | 50 GB/month |
| **Max** | 10 GB | 20 GB | Unlimited | Unlimited |

---

## 5. Billing & Payment Integration

### 5.1 Payment Processor: Stripe

**Integration Points:**
- Checkout (initial signup)
- Subscription management (upgrade/downgrade)
- Invoice history & PDF download
- Tax compliance (calculate sales tax per jurisdiction)
- Automatic retry for failed payments

**Data Model:**
```typescript
interface BillingRecord {
  id: string;
  userId: string;
  subscriptionId: string; // Stripe subscription ID
  stripeCustomerId: string;
  tierId: string;
  billingCycle: 'monthly' | 'annual';
  amount: number; // in cents
  currency: string; // USD, EUR, GBP
  nextBillingDate: Date;
  invoiceUrl: string;
  paymentMethod: {
    type: 'card' | 'bank_transfer';
    lastFour?: string;
    brand?: string;
  };
  status: 'active' | 'past_due' | 'canceled' | 'paused';
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 5.2 Subscription Lifecycle

**Creation:**
1. User selects tier + billing cycle
2. Redirect to Stripe Checkout (hosted)
3. Confirmation webhook → activate subscription
4. Send welcome email with invoice

**Upgrade:**
```
Pro → Max:
- Proration calculated by Stripe (prorated credit)
- New amount due immediately
- Confirmation email with new invoice
```

**Downgrade:**
```
Max → Pro:
- Stripe credits excess (refunded on next cycle or carried forward)
- Reduced features at next cycle start
- Warning email: "Your plan changes on DATE"
```

**Renewal:**
- 7 days before renewal: "Renewal upcoming" email
- Auto-charge on renewal date
- Failed payment: retry up to 3x over 10 days
- After 3 failures: pause subscription, send support email
- After 30 days: cancel and offer win-back discount

**Cancellation:**
- User initiates from settings
- Immediate deactivation (or end-of-cycle option)
- Final invoice sent
- Offer 20% discount for 3-month re-engagement

---

### 5.3 Discounts & Coupons

**Built-in Discounts:**
- Annual billing: 15% off (e.g., Max: $999 → $8487/year)
- Non-profit / educational: 50% off
- Volume discounts for 10+ team members

**Promotional Coupons:**
- Generate via admin dashboard
- Single-use or multi-use codes
- Expiration date + usage limits
- Tracked in audit logs

**Free Trial:**
- 14-day free trial of Pro tier (no payment method required initially)
- Automated email reminders (day 7, day 13)
- Auto-convert to paid or cancel on day 14

---

## 6. Neuro-Specific Features

### 6.1 Research Depth Access Control

**Feature Gating:**
```typescript
function isResearchDepthAllowed(userId: string, depthPreset: 'SQ'|'QK'|'NR'|'EX'|'MX'): boolean {
  const tier = getUserSubscriptionTier(userId);
  const depthMap = {
    'Starter': ['SQ', 'QK'],
    'Pro': ['SQ', 'QK', 'NR'],
    'Max': ['SQ', 'QK', 'NR', 'EX', 'MX'],
  };
  return depthMap[tier]?.includes(depthPreset) ?? false;
}
```

**UI Behavior:**
- Disabled presets greyed out with upsell tooltip
- "Upgrade to Pro to unlock Normal research" message
- "Unlock Extended + Visual Scouting with Max" message

---

### 6.2 Model Tier Access Restrictions

**Orchestrator & Reflection Agents:**
- Light tier: qwen3.5:2b only
- Standard/Quality: qwen3.5:4b (can swap to 9b with Quality)
- Max: qwen3.5:9b + 27b available

**Make Stage (Ad Creation):**
- Light/Standard: qwen3.5:9b
- Quality: qwen3.5:9b (prioritized)
- Max: qwen3.5:27b option

**Enforcement:**
```typescript
function getAvailableModels(userId: string, stage: string) {
  const tier = getUserModelTier(userId);
  const modelMap = {
    'Light': ['qwen3.5:0.8b', 'qwen3.5:2b'],
    'Standard': ['qwen3.5:2b', 'qwen3.5:4b'],
    'Quality': ['qwen3.5:4b', 'qwen3.5:9b'],
    'Maximum': ['qwen3.5:9b', 'qwen3.5:27b', 'gpt-oss-20b'],
  };
  return modelMap[tier] ?? [];
}
```

---

### 6.3 Chat History Retention

**Starter:** 30 days (auto-delete after 30 days of inactivity OR absolute 30-day window)
**Pro:** 90 days
**Max:** Unlimited (but user can request deletion)

**Implementation:**
```typescript
interface ChatRetentionPolicy {
  maxDays: number;
  autoDeleteOlder: boolean;
  allowManualDeletion: boolean;
  dataExportBeforeDelete: boolean;
}
```

---

### 6.4 Export Capabilities

**Starter:**
- Export single campaign (PDF only)
- Last 30 days chat history (JSON)

**Pro:**
- Export multiple campaigns (batch PDF)
- Full chat history (JSON, CSV)
- Research findings (Markdown)
- Ad concepts + test results (CSV/JSON)

**Max:**
- All Pro exports +
- Figma design file integration (auto-export concepts to Figma)
- API access to export programmatically
- Custom report generation (HTML, PDF, interactive dashboard)

---

## 7. Technical Requirements

### 7.1 Authentication & Authorization

**JWT-based Flow:**
1. User logs in → Receive JWT (httpOnly cookie + localStorage)
2. Refresh token rotation every 7 days
3. Access token expires in 1 hour
4. PKCE flow for mobile/SPA (future)

**Implementation:**
```typescript
interface JWTPayload {
  sub: string; // user ID
  email: string;
  tier: 'starter' | 'pro' | 'max';
  orgId?: string;
  orgRole?: string;
  iat: number;
  exp: number;
  aud: string; // e.g., 'api.neuro.ai'
}
```

**Session Management:**
- Blacklist revoked tokens (Redis with TTL)
- Logout clears httpOnly cookie + refresh token
- Multi-device support (max 5 active sessions per user, LRU expiration)

---

### 7.2 Payment Processor Integration

**Stripe API Calls:**
- `POST /create-checkout-session` → Stripe Checkout
- `POST /create-customer` → Customer creation
- `POST /update-subscription` → Plan changes
- `POST /cancel-subscription` → Cancellations
- `GET /invoices` → Invoice history
- Webhook: `customer.subscription.updated`, `invoice.payment_failed`, `charge.refunded`

**Webhook Handler:**
```typescript
app.post('/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case 'customer.subscription.updated':
      await updateUserSubscription(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
  }

  res.json({received: true});
});
```

---

### 7.3 Usage Analytics & Tracking

**Events Tracked:**
- Campaign creation, completion, deletion
- Research cycle start/end + depth used
- Model tier usage per stage
- Message count + token count
- Export/API calls
- Error rates

**Storage:** PostgreSQL time-series table or InfluxDB
- Aggregated hourly for billing
- Granular logs (24-hour TTL) for debugging

**Implementation:**
```typescript
interface UsageEvent {
  userId: string;
  organizationId: string;
  timestamp: Date;
  eventType: string; // 'campaign_created', 'research_cycle_start', etc.
  metadata: {
    campaignId?: string;
    depthPreset?: string;
    modelUsed?: string;
    tokensUsed?: number;
    duration?: number; // seconds
    status?: 'success' | 'failure';
  };
}
```

---

### 7.4 Rate Limiting

**Implementation:**
- Redis-backed sliding window algorithm
- Per-user, per-endpoint limits
- DDoS protection via Cloudflare (if cloud-hosted)

**Code Example:**
```typescript
async function checkRateLimit(userId: string, endpoint: string): Promise<boolean> {
  const key = `rate:${userId}:${endpoint}`;
  const limit = 100; // per minute
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count <= limit;
}
```

---

### 7.5 Data Encryption

**In Transit:**
- TLS 1.3 minimum
- Enforce HTTPS-only (HSTS header)

**At Rest:**
- User passwords: bcrypt (cost 12) or Argon2
- API keys: encrypted with AES-256-GCM (stored in DB)
- Sensitive metadata: encrypted column in DB (e.g., Stripe customer ID)
- PII fields: optional encryption for GDPR compliance

---

## 8. Self-Hosted Option

### 8.1 Deployment Model

**License Options:**
1. **Community License** (Free)
   - Self-hosted only
   - Single-user instance
   - Community support

2. **Professional License** ($2000/month or $18k/year)
   - Self-hosted or bring-your-own-cloud
   - Up to 10 users
   - Email support + monthly check-ins
   - Custom integrations

3. **Enterprise License** (Custom pricing)
   - Unlimited users
   - White-label option
   - Dedicated support + SLA
   - Custom feature development

---

### 8.2 Self-Hosted Features

**Must Support:**
- Docker Compose deployment (all-in-one or modular)
- PostgreSQL for data (local or remote)
- Redis for sessions/caching (local or remote)
- Local Ollama integration (or remote)
- Environment variable configuration
- SMTP for email notifications
- S3-compatible storage for attachments (or local filesystem)

**Optional:**
- Kubernetes Helm charts
- Terraform deployment templates
- CI/CD pipeline examples (GitHub Actions, GitLab CI)

**Limitations (Self-Hosted):**
- No Stripe integration (manual invoicing)
- No cloud backup (user responsible)
- No managed updates (user pulls latest)
- No auto-scaling (single instance recommended)
- Community-only support

---

### 8.3 License Verification

**Mechanism:**
- License key validated on server startup
- Phone-home every 30 days (can be disabled for air-gapped deployments)
- Graceful degradation if license invalid (read-only mode)
- Offline mode supported with last-known-good license state

---

## 9. Business Model Options

### Option A: Pure Subscription (Recommended)

**Pros:**
- Predictable recurring revenue
- Simple to understand
- Easy upgrades/downgrades
- Works for both cloud and self-hosted tiers

**Cons:**
- May not appeal to light users
- Unused quota frustration

**Implementation:**
- Starter: $99/month or $890/year (15% discount)
- Pro: $299/month or $2,691/year
- Max: $999/month or $8,991/year

---

### Option B: Hybrid (Subscription + Pay-as-You-Go)

**Pros:**
- Attracts low-volume users
- Monetizes heavy users better
- Flexibility

**Cons:**
- Complex billing
- Variable revenue
- Unpredictable costs for users

**Implementation:**
```
Base Tier: $49/month (Starter with 100 messages/month)
  Overage: $0.10 per message
  Overage: $5 per research cycle over 5/month

Pro Tier: $249/month (5000 messages/month included)
  Overage: $0.05 per message

Max Tier: $799/month (Unlimited)
```

---

### Option C: Per-Usage with Free Tier

**Pros:**
- No commitment barrier
- Pay only for what you use
- Aligns with SaaS trends (AWS-like)

**Cons:**
- Unpredictable user costs
- Harder to forecast revenue
- User anxiety over bills

**Implementation:**
```
Free Tier:
- 1 campaign/month
- 100 messages/month
- SQ research only
- 7-day chat history
- Public gallery access

Pay-as-you-go:
- $0.10 per message (first 10,000/month)
- $0.05 per message (10,001–50,000/month)
- $0.02 per message (50,000+/month)
- $10 per NR research cycle
- $20 per EX research cycle
- $50 per MX research cycle
- $99/month for unlimited up to Pro tier

Capped at Pro tier equivalent cost for safety
```

---

## 10. Recommended Approach

**Recommendation: Option A (Pure Subscription) + Option B (Pay-as-You-Go Tiers)**

**Rationale:**
1. **Starter to Pro:** Pure subscription encourages committed users and simplifies billing
2. **Pro to Max:** Hybrid allows deep power users to pay only for what they need (e.g., 2 MX cycles/month at $100 = cheaper than Max subscription)
3. **Add-ons:** Community sentiment analysis, Priority support, Advanced reporting
4. **Annual Discount:** 15% off all tiers paid annually (cash flow boost)

**Pricing Example:**
| **Tier** | **Monthly** | **Annual** | **Add-ons** |
|---|---|---|---|
| **Starter** | $99 | $890 | +$50 Community research |
| **Pro** | $299 | $2,691 | +$100 Quality models, +$50 Community |
| **Max** | $999 | $8,991 | All included |
| **Starter → Pro Overage** | — | — | $50/month for each extra campaign quota |

**Self-Hosted:**
- Professional License: $2000/month (up to 10 users, white-label ready)
- Enterprise License: Custom (volume discounts, dedicated support)

---

## 11. Implementation Roadmap

### Phase 1: MVP (Month 1–2)
- Basic auth (email/password)
- Single subscription tier (Pro equivalent)
- Stripe integration (create customer, manage subscription)
- Usage tracking (messages, campaigns, cycles)
- Email notifications (renewal reminders, payment failures)

### Phase 2: Multi-Tier (Month 3–4)
- 3 subscription tiers (Starter, Pro, Max)
- Feature gating (research depth, model tiers)
- Usage quota enforcement
- Admin dashboard (subscription analytics)
- Invoice history + PDF download

### Phase 3: Team & Enterprise (Month 5–6)
- Organization management
- Role-based access control
- Team invitations
- Shared resources (templates, research)
- Audit logs

### Phase 4: Advanced (Month 7+)
- Self-hosted license key system
- Advanced analytics dashboard
- Custom integrations (Slack, webhooks)
- API access (read/write)
- White-label option

---

## 12. Security & Compliance

**Standards:**
- GDPR compliance (user consent, data portability, deletion)
- CCPA compliance (California privacy)
- SOC 2 Type II certification (for enterprise tier)
- PCI DSS: Stripe handles all card data (we use Stripe tokens only)

**Key Practices:**
- Regular security audits (quarterly)
- Penetration testing (annual)
- OWASP Top 10 compliance
- Dependency scanning (Snyk, npm audit)
- Secrets management (HashiCorp Vault or AWS Secrets Manager)
- Rate limiting + DDoS protection

---

## 13. Support & SLA

| **Tier** | **Support Channel** | **Response Time** | **SLA** |
|---|---|---|---|
| **Starter** | Community forum | 48–72 hours | Best effort |
| **Pro** | Email | 24 hours | 99.5% uptime |
| **Max** | Email + Slack | 1–2 hours | 99.9% uptime |
| **Enterprise** | Dedicated manager | 30 min | 99.95% uptime + custom SLA |

**Uptime Monitoring:**
- Automated monitoring (Datadog, New Relic)
- Status page (public, real-time)
- Incident communication via email + Slack

---

## 14. Future Enhancements

1. **Affiliate Program** — Users earn commissions (20%) for referrals
2. **Marketplace** — Third-party integrations (CMS, email platforms, ad networks)
3. **White-label SaaS** — Agencies resell as branded product
4. **Seat-based Pricing** — Per-user pricing instead of team pools
5. **Usage-Based Overages** — Automatic overage billing once quota exceeded
6. **Commitment Discounts** — 20% off 2-year prepay

---

## Conclusion

This SaaS requirements document establishes a scalable, flexible business model for Neuro that serves both individual creators and enterprise teams. The recommended pure-subscription approach (Option A) provides predictable revenue while supporting hybrid pricing for power users. Phase-based implementation allows iterative feature rollout with manageable technical debt and user migration.

Key success metrics:
- Monthly recurring revenue (MRR)
- Customer acquisition cost (CAC)
- Lifetime value (LTV)
- Net retention rate (NRR)
- Churn rate (target: <5% monthly)
