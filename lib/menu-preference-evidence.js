'use strict';
const norm = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function categoryMatches(dish, preference, kind) {
 const category = norm(dish.menuCategory);
 if (!category) return false;
 if (kind === 'cuisine') {
  if (preference === 'north indian') return /^(punjabi|north indian)( |$)/.test(category);
  if (preference === 'south indian') return /^south indian( |$)/.test(category);
  if (preference === 'maharashtrian') return /^maharashtrian( |$)/.test(category);
  if (preference === 'chinese') return /^chinese( |$)/.test(category);
  if (preference === 'italian') return /^italian( |$)/.test(category);
  if (preference === 'continental') return /^continental( |$)/.test(category);
  if (preference === 'indian') return /^(punjabi|north indian|south indian|maharashtrian|indian)( |$)/.test(category);
 }
 if (kind === 'taste' && preference === 'light') return /^(salad|salads|clear soups?)$/.test(category);
 if (kind === 'mood' && ['lunch','dinner','family meal'].includes(preference)) {
  return /^(main course|main affairs|main course vegetarian|main course non vegetarian|punjabi gravies|chinese mains|large plates|veg plates|non veg plates|salads|salad)$/.test(category);
 }
 return false;
}
module.exports={categoryMatches};
