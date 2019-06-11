import { Map, List } from "immutable";
import { createSelector } from "reselect";

// Exported just for testing
export const index = (data, indexBy) => {
  if (indexBy.isMultiBucket) {
    return indexBy.group(data);
  }

  switch(typeof(indexBy)) {
    case "function":
      return data.groupBy(indexBy);

    case "string":
      return data.groupBy(value => value.get(indexBy));

    default:
      // Array, so recursively generate nested groups
      const [firstKey, ...rest] = indexBy;
      if (!firstKey) {
        return data;
      }
      const indexed = index(data, firstKey);
      return indexed.map((group) => {
        return index(group, rest);
      });
  }
};

export const multiBucket = (indexBy) => {
  let indexFunc;
  const type = typeof(indexBy);
  if (type === "string") {
    indexFunc = (obj) => obj.get(indexBy);
  } else if (type === "function") {
    indexFunc = indexBy;
  } else {
    throw new Error(`Index type \`${type}\` not supported by multiBucket - must be string (key) or function.`);
  }
  return {
    isMultiBucket: true,
    group(data) {
      const isMap = Map.isMap(data);
      return data.reduce((result, obj, objKey) => {
        const keys = indexFunc(obj);
        return keys.reduce((r, key) => {
          if (isMap) {
            return r.setIn([key, objKey], obj);
          }
          return r.update(key, (list) => list ? list.push(obj) : List.of(obj));
        }, result);
      }, new Map());
    }
  };
};

export const createTable = ({selector, indices}) => {
  const indexedSelectors = {};
  Object.keys(indices).forEach(indexKey => {
    indexedSelectors[indexKey] = createSelector(
      selector,
      (data) => {
        return index(data, indices[indexKey]);
      },
    );
  });
  return {
    unindexedSelector: selector,

    reselectSource(...args) {
      const resultFunc = args.pop();
      const newSourceSelector = createSelector(selector, ...args, resultFunc);
      return createTable({
        selector: newSourceSelector,
        indices,
      });
    },

    indexedSelector(indexName) {
      const selector = indexedSelectors[indexName];
      if (!selector) {
        const available = Object.keys(indices).join(", ");
        throw(new Error(`Indexed selector \`${indexName}\` not found on table. Available indices are [${available}]`));
      }
      return selector;
    },
  };
};

