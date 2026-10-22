[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / nodesFrom

# Function: nodesFrom()

> **nodesFrom**\<`T`\>(`connection`): `T`[]

Defined in: [sdks/js/src/pagination.ts:53](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/pagination.ts#L53)

Extracts the nodes from a Relay-style connection.

## Type Parameters

### T

`T`

## Parameters

### connection

[`Connection`](../interfaces/Connection.md)\<`T`\>

A connection returned by an SDK list method.

## Returns

`T`[]

The `node` value from each edge, preserving order.

## Example

```ts
const connection: Connection<string> = {
  edges: [{ cursor: "cursor-1", node: "campaign-1" }],
  pageInfo: {
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: "cursor-1",
    endCursor: "cursor-1",
  },
};

const campaigns = nodesFrom(connection);
console.log(campaigns); // ["campaign-1"]
```
