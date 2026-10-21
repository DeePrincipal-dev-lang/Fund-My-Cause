[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / Connection

# Interface: Connection\<T\>

Defined in: [sdks/js/src/pagination.ts:25](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/pagination.ts#L25)

A Relay-style cursor connection returned by paginated SDK methods.

## Type Parameters

### T

`T`

The type of node contained in each edge.

## Properties

### edges

> **edges**: `object`[]

Defined in: [sdks/js/src/pagination.ts:27](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/pagination.ts#L27)

The nodes in this page, paired with their opaque pagination cursors.

#### Type declaration

`cursor`: `string`

`node`: `T`

***

### pageInfo

> **pageInfo**: [`PageInfo`](PageInfo.md)

Defined in: [sdks/js/src/pagination.ts:29](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/pagination.ts#L29)

Cursors and flags used to navigate to adjacent pages.
