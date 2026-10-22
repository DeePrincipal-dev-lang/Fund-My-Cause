[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / PageInfo

# Interface: PageInfo

Defined in: [sdks/js/src/pagination.ts:9](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/pagination.ts#L9)

Relay-style pagination metadata for a [Connection](Connection.md).

## Properties

### hasNextPage

> **hasNextPage**: `boolean`

Defined in: [sdks/js/src/pagination.ts:11](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/pagination.ts#L11)

Whether another page exists after the current one.

***

### hasPreviousPage

> **hasPreviousPage**: `boolean`

Defined in: [sdks/js/src/pagination.ts:13](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/pagination.ts#L13)

Whether a page exists before the current one.

***

### startCursor

> **startCursor**: `string` \| `null`

Defined in: [sdks/js/src/pagination.ts:15](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/pagination.ts#L15)

Cursor for the first edge in this page, or `null` when the page is empty.

***

### endCursor

> **endCursor**: `string` \| `null`

Defined in: [sdks/js/src/pagination.ts:17](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/pagination.ts#L17)

Cursor for the last edge in this page, or `null` when the page is empty.
