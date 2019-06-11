import Immutable from "immutable";

import { index } from "./indexr";

const item1 = {
  id: "id1",
  key1: "a",
  key2: "b",
  key3: "c",
};

const item2 = {
  id: "id2",
  key1: "a",
  key2: "b",
  key3: "d",
};

const item3 = {
  id: "id3",
  key1: "b",
  key2: "a",
  key3: "c",
};

const collection = Immutable.fromJS({
  id1: item1,
  id2: item2,
  id3: item3,
});

test('indexes a collection by string', () => {
  const result = index(collection, "key1");
  expect(result).toEqual(Immutable.fromJS({
    a: {
      id1: item1,
      id2: item2,
    },
    b: {
      id3: item3,
    },
  }));
});

test('indexes a collection by array', () => {
  const result = index(collection, ["key1", "key2", "key3"]);
  expect(result).toEqual(Immutable.fromJS({
    a: {
      b: {
        c: {
          id1: item1,
        },
        d: {
          id2: item2,
        },
      },
    },
    b: {
      a: {
        c: {
          id3: item3,
        },
      },
    },
  }));
});

