# indexr.js

## `createTable`

Indexr introduces a higher-order selector which is dubbed a "table", because it
acts a bit like a database table which is able to be "queried" by attribute.

A table is created via `createTable`, which takes a `selector` that is expected
to return a collection (can either be a map (e.g. if keyed by id) or a list),
and `indices`, a mapping of ways to index that collection.

Here's an example:

```js
import {createSelector} from 'reselect';
import {createTable} from '../indexr';

// normalized data in store
const getAllComments = state => state.comments;
// from UI store
const getSelectedPostId = state => state.selectedPostId;

// inefficient

const getCommentsForSelectedPost = createSelector(
  getAllComments,
  getSelectedPostId,
  (allComments, selectedPostId) => {
    return allComments.filter(comment => {
      return comment.get('postId') === selectedPostId;
    });
  },
);

// more efficient

// build comments table "indexed" on postId, based on the original selector
const commentsTable = createTable({
  selector: getAllComments,
  indices: {
    byPostId: comment => comment.get('postId'),
    // same as example above, `get` is inferred if a string is given:
    byPostId: 'postId',
  },
});

// get a version of the original selector from the table that returns its data
// in Map form, mapping postIds to arrays of items with that postId
const getCommentsForSelectedPost = createSelector(
  commentsTable.indexedSelector('byPostId'),
  getSelectedPostId,
  (commentsByPostId, selectedPostId) => {
    return commentsByPostId.get(selectedPostId);
  },
);
```

In the inefficient example, whenever `state.selectedPostId` changes, we do an
O(N) search, even if `state.comments` doesn't change at all.

Using a table is more efficient because whenever `state.comments` changes, the
table reconstructs the index, but every time `state.selectedPostId` changes,
it's only an O(1) operation.

Each value of the `indices` can be a:

- **function** (called on the collection object, returns value to be used as
  index key)
- **string** (equivalent to a function that calls `.get(<string>)` on the
  object)
- **multibucket** (see section below)
- **array** (use for multiple levels of indices - accepts **functions**,
  **strings**, or **multibuckets** as described before.)

Some more examples with output:

```js
const byDayCreated = comment => DateTime.parse(comment.get('postId')).startOf('day');
const commentsTable = createTable({
  selector: getAllComments,
  indices: {
    byDayCreated,
    byMultipleKeys: ['postId', byDayCreated],
  },
});

// multiple index usage:
commentsTable.indexedSelector('byMultipleKeys')(state)
=>
{
  postId1: {
    2019-02-20: <collection of comments for post1 written on 2019-02-20>,
    2019-02-19: <collection of comments for post1 written on 2019-02-21>,
  },
  postId2: {
    2019-02-20: <collection of comments for post2 written on 2019-02-20>,
  }
}
```

#### `multiBucket`

Sometimes you want a single object to appear in multiple "groups"/"buckets" at
once. This may occur if your object has an array key (even though your stores
may be denormalized), or you can always provide your custom function that
returns an array of possible indices.

The index values must be iterable (Map or List).

```js
import { createTable, multiBucket } from '../indexr';

const commentsTable = createTable({
  selector: getAllComments,
  indices: {
    byTag: multiBucket('tags'),
    byTagAndLength: [multiBucket('tags'), c => c.get('tags').count()],
  },
});

// comments (object with ID 3 has both 'a' and 'b' tags, so will appear in both)
// note that both Lists and Maps work as the original selector data structure.
// using a map keyed by ID is recommended but an array is more illustrative
[{id: 1, tags: ['a']}, {id: 2, tags: ['b']}, {id: 3, tags: ['a', 'b']}]

commentsTable.indexedSelector('byTag')(state)
=>
{
  a: [{id: 1, tags: ['a']}, {id: 3, tags: ['a', 'b']}],
  b: [{id: 2, tags: ['b']}, {id: 3, tags: ['a', 'b']}],
}

// multiBuckets can be used in combination with other indices if desired
commentsTable.indexedSelector('byTagAndLength')(state)
=>
{
  a: {
    1: [{id: 1, tags: ['a']}],
    2: [{id: 3, tags: ['a', 'b']}],
  },
  b: {
    1: [{id: 2, tags: ['b']}],
    2: [{id: 3, tags: ['a', 'b']}],
  },
}
```

## `unindexedSelector`

If you ever need the original, raw collection that was passed in as `selector`
to `createTable`, you can access `unindexedSelector` directly on the table.

```js
createSelector(
  commentsTable.unindexedSelector,
  (comments) => {
    ...
  }
)
```

## `reselectSource`

If you need to do some transformation to the table's data ("reselect" the
original table's source selector), you can use this function to generate a new
table:

```js
const getRatingFilter = state => state.ratingFilter;
const ratingFilteredCommentsTable = commentsTable.reselectSource(
  getRatingFilter,
  (comments, ratingFilter) => {
    return comments.filter(c => c.get('rating') >= ratingFilter);
  },
);
```

Note that the signature of `reselectSource` is very similar to
`createSelector` - except the very first argument (the original table source
collection) is implicit/omitted, and passed directly into the result function.

Note that a more performant solution in this case might be to add rating (or
even the conditional expression) as an index, but sometimes the
filter/transformation is more complicated. Regardless, this is not recommended
for common usage.
