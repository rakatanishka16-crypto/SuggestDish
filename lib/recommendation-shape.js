module.exports=function safeRecommendationRows(parsed){
 if(!parsed || typeof parsed!=='object' || Array.isArray(parsed) || !Array.isArray(parsed.recommendations))return [];
 return parsed.recommendations.filter(item=>item!==null && typeof item==='object' && !Array.isArray(item));
};
