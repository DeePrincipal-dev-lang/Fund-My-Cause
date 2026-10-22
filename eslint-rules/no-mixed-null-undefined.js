module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow mixing null and undefined in union types',
      category: 'Stylistic Issues',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
  },
  create(context) {
    return {
      TSUnionType(node) {
        const hasNull = node.types.some(t => t.type === 'TSNullKeyword');
        const hasUndefined = node.types.some(t => t.type === 'TSUndefinedKeyword');
        
        if (hasNull && hasUndefined) {
          context.report({
            node,
            message: 'Do not mix null and undefined in the same type. Use one or the other.',
          });
        }
      },
    };
  },
};
