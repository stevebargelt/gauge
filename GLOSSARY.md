# gauge

Terms for what gauge shows.

## Language

**Plan limit**:
A subscription's cap on use, set by the provider and reported as the share of a window already used.
_Avoid_: quota, rate limit, usage (alone)

**Window**:
The period a plan limit applies to: the 5-hour window, the weekly window, or a per-model weekly window. Each has a reset time.
_Avoid_: session, period

**Pace**:
The share of a window used against the share of that window's time elapsed. Above 100% means the limit will be reached before the window resets.
_Avoid_: burn rate

**Reading**:
One observation of a service's windows, with the time it was observed. A reading is live, or stale when it came from a local file rather than the provider.
_Avoid_: snapshot, sample

**Service**:
One way of reaching a model that gauge reports on: a Claude or Codex subscription, an API key, or Bedrock. Only subscriptions have plan limits.
_Avoid_: provider, channel, account

**Consumption**:
Tokens used over time, by day, model or project. Not shown yet.
_Avoid_: usage (alone), spend
