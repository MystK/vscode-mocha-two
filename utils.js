exports.trimArray = function trimArray(array) {
  return array.reduce((trimmed, item) => {
    if (item) trimmed.push(item);

    return trimmed;
  }, []);
};
