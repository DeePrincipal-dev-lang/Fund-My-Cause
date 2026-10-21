# Translation key conventions

`messages/*.json` holds one namespace per top-level key, matching the
`useTranslations("namespace")` call in the component(s) that use it (e.g.
`useTranslations("campaignCard")` reads from the `campaignCard` namespace).

## Naming

- **Namespace**: `camelCase`, named after the component or route it belongs
  to (`campaignCard`, `pledgeModal`, `bookmarks`), not after the feature area
  in the abstract. One namespace can be shared by several closely related
  components (e.g. a page and the modal it opens) when they're never
  rendered without each other.
- **Key**: `camelCase`, describing the string's role in the UI
  (`heroTitle`, `sortEndingSoon`, `networkMismatch`), not its literal text.
- Every locale file must define the exact same set of keys — a missing key
  falls back silently in `next-intl`, which hides broken translations
  instead of surfacing them.

## Adding a key

1. Add it to `messages/en.json` first, then mirror the same key path into
   every other locale file with a translated value.
2. Only add a key once it's referenced from a `t("...")` call — an
   unreferenced key is dead weight that ships to every locale bundle.

## Removing a key

Before deleting a key, confirm it isn't referenced:

- Statically, via `t("key")` / `t.rich("key")` / `t.has("key")` calls bound
  to that namespace.
- Dynamically, via a template literal or a variable built from another
  value (e.g. `` t(`status.${status}`) ``) — grep for the key's leaf name
  across `src/`, not just for the literal `t("...")` call, before treating
  it as unused.

Then remove it from **all** locale files in the same change so they stay in
sync.

## Unused keys

Checked against `messages/en.json`: every key's leaf name appears in the source under
`src/`, so no key is unused. Keys are read with `t("…")`, `t.raw("…")`, or through a
namespace. Before removing a key, search for its leaf name in `src/` and check the dynamic
`t(\`…${x}\`)` forms too.
