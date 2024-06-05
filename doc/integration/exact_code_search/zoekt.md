---
stage: Data Stores
group: Global Search
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://handbook.gitlab.com/handbook/product/ux/technical-writing/#assignments
---

# Zoekt

DETAILS:
**Tier:** Premium, Ultimate
**Offering:** Self-managed
**Status:** Beta

> - [Introduced](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/105049) as a [beta](../../policy/experiment-beta-support.md#beta) in GitLab 15.9 [with flags](../../administration/feature_flags.md) named `index_code_with_zoekt` and `search_code_with_zoekt`. Disabled by default.
> - [Enabled on GitLab.com](https://gitlab.com/gitlab-org/gitlab/-/issues/388519) in GitLab 16.6.
> - Feature flags `index_code_with_zoekt` and `search_code_with_zoekt` [removed](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/148378) in GitLab 17.1.

WARNING:
This feature is in [beta](../../policy/experiment-beta-support.md#beta) and subject to change without notice.
For more information, see [epic 9404](https://gitlab.com/groups/gitlab-org/-/epics/9404).

Zoekt is an open-source search engine designed specifically to search for code.

With this integration, you can search for code faster and more efficiently.
You can use regular expression and exact match modes to search for code in a group or repository.

## Enable exact code search

To enable [exact code search](../../user/search/exact_code_search.md) in GitLab:

1. On the left sidebar, at the bottom, select **Admin Area**.
1. Select **Settings > Search**.
1. Expand **Exact code search configuration**.
1. Select the **Enable indexing for exact code search** and **Enable exact code search** checkboxes.
1. Select **Save changes**.

## Pause indexing

To pause indexing for [exact code search](../../user/search/exact_code_search.md):

1. On the left sidebar, at the bottom, select **Admin Area**.
1. Select **Settings > Search**.
1. Expand **Exact code search configuration**.
1. Select the **Pause indexing for exact code search** checkbox.
1. Select **Save changes**.

When you pause indexing for exact code search, all changes in your repository are queued.
To resume indexing, clear the **Pause indexing for exact code search** checkbox.
