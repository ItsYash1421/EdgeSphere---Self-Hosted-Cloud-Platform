# Phase 3 — Event-Driven Analytics & Notifications

## Architecture

### Event Flow
```text
Gateway/CDN → PUBLISH request.events → Kafka → Analytics Consumer → TimescaleDB
                                                                  ↓
                                              Notification Service polls Analytics
                                              If threshold breached → Email/Webhook/Slack
```

### Analytics Service
- Kafka consumer (group: analytics-group)
- Batch insert into TimescaleDB (up to 1000 events per batch)
- 11 query endpoints: rate, percentiles, geo, top paths, bandwidth, errors
- time_bucket() for time-series aggregation

### Notification Service  
- 4 default alert rules (in-memory)
- Checks every 60 seconds via setInterval
- Debounce: 10 minutes per rule (won't re-alert too fast)
- Channels: Email (Nodemailer), Webhook (axios), Slack (incoming webhooks)

### Dashboard Updates
- Analytics page: real API data via SWR (10-30s refresh)
- Alerts page: rule management + history
- Live Events page: 3s auto-refresh event stream
