'use strict';
// Compatibility for the existing production variable spelling. Do not expose
// either value. The canonical setting wins, including an invalid empty value.
module.exports=function reviewerKey(env=process.env){return env.BUSINESS_REVIEW_KEY ?? env.BUSINESS_REVEIW_KEY;};
