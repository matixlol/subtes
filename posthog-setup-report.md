# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Subte porteño, an Astro (View Transitions) site that visualizes Buenos Aires subway data. The following changes were made:

- **`src/components/posthog.astro`** (new): PostHog snippet component using `is:inline` with a `window.__posthog_initialized` guard to prevent stack overflow during ClientRouter soft navigation, and `capture_pageview: 'history_change'` for automatic pageview tracking. Reads API key and host from environment variables.
- **`src/pages/index.astro`**: Imported and added `<PostHog />` to the `<head>`. Added a tracking script that fires `scroll_to_content_clicked` when the hero scroll arrow is clicked, and `line_link_clicked` (with `line_code` property) when a line button in the accessibility table is clicked.
- **`src/pages/linea/[line].astro`**: Imported and added `<PostHog />` to the `<head>`. Extended the existing inline scroll/navigation script to fire `line_viewed` (with `line_code`) when the user swipes or navigates to a different subway line, and `station_tooltip_opened` (with `station_name` and `line_code`) when a station tooltip is shown.
- **`.env`** (new): Created with `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST` environment variables.

| Event | Description | File |
|---|---|---|
| `line_viewed` | Fired when the user navigates to a different subway line on the linea page (via swipe, scroll, or button). Properties: `line_code`. | `src/pages/linea/[line].astro` |
| `station_tooltip_opened` | Fired when the user opens the accessibility tooltip for a station. Properties: `station_name`, `line_code`. | `src/pages/linea/[line].astro` |
| `line_link_clicked` | Fired when a line button in the homepage accessibility table is clicked. Properties: `line_code`. | `src/pages/index.astro` |
| `scroll_to_content_clicked` | Fired when the hero scroll arrow is clicked to jump to the accessibility section. | `src/pages/index.astro` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard**: [Analytics basics](https://us.posthog.com/project/341058/dashboard/1357660)
- **Insight**: [All custom events over time](https://us.posthog.com/project/341058/insights/Zj3k4Hi2) — daily trend of all four events
- **Insight**: [Line views breakdown by line](https://us.posthog.com/project/341058/insights/303zPto6) — which lines users visit most
- **Insight**: [Homepage to line detail funnel](https://us.posthog.com/project/341058/insights/VYKH4aIp) — conversion from homepage through to line detail page
- **Insight**: [Station tooltip opens by line](https://us.posthog.com/project/341058/insights/2kkBajKZ) — which lines have the most station detail exploration

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
