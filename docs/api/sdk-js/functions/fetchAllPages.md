[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / fetchAllPages

# Function: fetchAllPages()

> **fetchAllPages**\<`T`\>(`fetchPage`, `pageLimit`?): `Promise`\<`T`[]\>

Defined in: [sdks/js/src/pagination.ts:74](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/pagination.ts#L74)

Repeatedly calls `fetchPage` following `endCursor` until `hasNextPage`
is false, returning all nodes. Intended for SDK consumers that need the
full list rather than paged UI rendering.

## Type Parameters

### T

`T`

## Parameters

### fetchPage

(`after`) => `Promise`\<[`Connection`](../interfaces/Connection.md)\<`T`\>\>

Loads one page. Receives the previous page's end cursor,
or `null` for the first page.

### pageLimit?

`number` = `50`

Maximum number of pages to request. Defaults to `50`.

## Returns

`Promise`\<`T`[]\>

Every node from the fetched pages, in order.

## Example

```ts
const campaigns = await fetchAllPages(async (after) => {
  const response = await fetch(`/api/campaigns?after=${after ?? ""}`);
  return response.json() as Promise<Connection<string>>;
});
```
