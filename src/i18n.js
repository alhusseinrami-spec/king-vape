/* ---------- languages: English and Arabic (RTL). Product and flavor names stay as the shop writes them. */
var T = {
en: {
  tag1:'Vape Lounge', tag2:'Premium E-Liquids', admin:'Admin', close:'Close',
  cartAria:'Open your order', searchAria:'Search products and flavors', searchPh:'Search flavors',
  catsAria:'Categories', subsAria:'Subcategories', switchTo:'Switch to Arabic',
  all:'All', allProducts:'All products', resultsFor:function(q){ return 'Results for “' + q + '”'; },
  intro:'Tap a product, choose your flavors and quantity, then send the order to our WhatsApp.',
  noneT:'Nothing matches that search', noneB:'Try a flavor name like mango, watermelon or grape.',
  allOf:function(c){ return 'All ' + c.toLowerCase(); },
  inOrder:function(n){ return n + ' in order'; }, askPrice:'Ask for price', soldOut:'Sold out', unavailable:'Unavailable',
  viewOrder:function(n){ return 'View order, ' + n; },
  each:'each', priceOnWa:'Ask for price. We confirm it on WhatsApp.', unavailNote:'Currently unavailable. Ask us on WhatsApp when it is back.',
  chooseFlavor:'Choose flavors', chooseColor:'Choose colors', chooseCombo:'Choose flavor combos', qty:'Quantity', howMany:'How many',
  nAvail:function(n){ return n + ' available'; },
  addTo:function(n){ return 'Add to order, ' + n; }, updateTo:function(n){ return 'Update order, ' + n; },
  removeFrom:'Remove from order', pickOne:'Pick at least one', pickQty:'Choose a quantity', notNow:'Currently unavailable',
  tAdded:'Added to your order', tUpdated:'Order updated', tRemoved:'Removed from your order', tCleared:'Order cleared',
  tDropped:'Some items in your order are no longer available and were removed.',
  yourOrder:'Your order', emptyT:'Your order is empty', emptyB:'Pick a product, choose flavors, and it shows up here.', browse:'Browse products',
  fName:'Your name', fNamePh:'Name for the order', fAddr:'Address or area (optional)', fAddrPh:'For delivery',
  fNotes:'Notes (optional)', fNotesPh:'Anything we should know', fErr:'Add your name so we know who the order is for.',
  seeMsg:'See the message we will send', msgAria:'Order message', copy:'Copy message', copied:'Message copied', waHelp:'Did WhatsApp not open? Copy your order, open our chat and paste it.', copyOrder:'Copy order', openChat:'Open chat', fErrT:'Add your name first, then send.', copyFail:'Select the text and copy it',
  cartPrice:function(p){ return p + ' each'; }, cartPriceWa:'Price confirmed on WhatsApp',
  toConfirm:'To confirm', pendingWa:function(n){ return '+ ' + n + ' priced on WhatsApp'; },
  send:'Send order on WhatsApp', fine1:'Your order opens in WhatsApp for', fine2:'. Press Send there to place it.',
  clear:'Clear order', clear2:'Tap again to clear the whole order', opening:'Opening WhatsApp. Press Send there to place the order.',
  remove1:'Remove one', add1:'Add one', removeP:function(n){ return 'Remove ' + n; },
  footOrders:'Orders go to WhatsApp at', chat:'Chat on WhatsApp',
  footPrices:'Prices are in US dollars. We confirm availability and the final price on WhatsApp.', footAge:'Nicotine is addictive. For adults 18 and over only.',
  gateTxt:'This catalogue shows nicotine products. You must be 18 or older to enter.', gateYes:'I am 18 or older', gateNoBtn:'I am under 18',
  sorry:'Sorry', gateNo:'You need to be 18 or older to view this catalogue.',
  mHead:'*New order from the King Vape catalogue*', mName:'Name', mAddr:'Address', mOrder:'Order', mTotal:'Total', mPlus:function(n){ return ' plus ' + n + ' to be priced'; },
  mTbc:'to be confirmed', mNotes:'Notes',
  /* admin */
  aTitle:'Manage products', aSub:'Only people with edit access to this page see this.', aSearch:'Search products', aSoldOnly:'Sold out only', aAdd:'Add product',
  aDiscard:'Discard', aSave:function(n){ return n ? 'Save and publish (' + n + ')' : 'Save and publish'; },
  aNone:'No changes yet', aUnsaved:function(n){ return n + ' unsaved'; }, aSaving:'Saving…', aSaved:'Saved. The page is reloading.',
  aOn:'Available', aOff:'Sold out', aNew:'New product', aEdit:'Edit', editThis:'Edit stock and flavors', aEmpty:'No products match.',
  aName:'Name', aNameAr:'Name in Arabic (optional)', aCat:'Category', aSub2:'Subcategory', aPrice:'Price in USD (empty = ask for price)',
  aSpecs:'Details, separated by commas', aNote:'Note (English)', aNoteAr:'Note (Arabic)', aKind:'Options are', aKFlavor:'Flavors', aKColor:'Colors', aKCombo:'Flavor combos',
  aPhoto:'Photo', aChangePhoto:'Change photo', aPhotoHint:'Best: a square photo on a transparent or plain background.', aUploading:'Uploading…', aPhotoFail:'Could not upload that photo. Try a smaller one.',
  aOptions:'Options', aPhFlavor:'Mango Ice\nStrawberry Kiwi', aPhColor:'Black\nSilver\nBlue', aPhCombo:'Mango + Ice\nApple + Mint', aOptHint:'Switch one off when it runs out.', aAllOn:'All available', aAllOff:'All sold out', aAddOpts:'Add more, one per line or separated by commas', aAddOptsBtn:'Add', aNoOpts:'Nothing added yet, so customers only pick a quantity. Add the flavors or colors below and each one gets its own sold-out switch.',
  aDelOpt:'Remove option', aDelProd:'Delete product', aDelProd2:'Tap again to delete', aNoSub:'None',
  aDefName:'New product', aNeedName:'Give every new product a name before saving.',
  aRestore:'Your last edits were not saved because someone else published first.', aRestoreBtn:'Restore my edits', aDropBtn:'Discard',
  aErrReadOnly:'Your account cannot save this page. Ask the owner to give you edit access.', aErrConflict:'Someone else published first. The page is reloading and your edits are kept to restore.',
  aErrRate:'Too many saves in a row. Wait a minute and try again.', aErrLarge:'The page is too large to save. Remove some photos or use smaller ones.',
  aErrOff:'Saving is not available here.', aErrGeneric:'Could not save. Try again.', aErrNoAdmin:'Saving is not available in this copy of the catalogue.',
  aDirtyClose:'You have unsaved changes. Close again to leave them.'
},
ar: {
  tag1:'فيب لاونج', tag2:'سوائل فيب فاخرة', admin:'الإدارة', close:'إغلاق',
  cartAria:'افتح طلبك', searchAria:'ابحث في المنتجات والنكهات', searchPh:'ابحث عن نكهة',
  catsAria:'الفئات', subsAria:'الفئات الفرعية', switchTo:'التبديل إلى الإنجليزية',
  all:'الكل', allProducts:'كل المنتجات', resultsFor:function(q){ return 'نتائج «' + q + '»'; },
  intro:'اختر منتجاً ثم النكهات والكمية، وأرسل طلبك مباشرة إلى واتساب.',
  noneT:'لا توجد نتائج', noneB:'جرّب اسم نكهة مثل مانجو أو بطيخ أو عنب.',
  allOf:function(c){ return 'كل ' + c; },
  inOrder:function(n){ return n + ' في الطلب'; }, askPrice:'السعر عند الطلب', soldOut:'غير متوفر', unavailable:'غير متوفر',
  viewOrder:function(n){ return 'عرض الطلب، ' + n; },
  each:'للقطعة', priceOnWa:'السعر يُؤكَّد عبر واتساب.', unavailNote:'غير متوفر حالياً. اسألنا عبر واتساب عن موعد توفره.',
  chooseFlavor:'اختر النكهات', chooseColor:'اختر الألوان', chooseCombo:'اختر تشكيلة النكهات', qty:'الكمية', howMany:'العدد',
  nAvail:function(n){ return 'المتوفر: ' + n; },
  addTo:function(n){ return 'أضف إلى الطلب، ' + n; }, updateTo:function(n){ return 'تحديث الطلب، ' + n; },
  removeFrom:'إزالة من الطلب', pickOne:'اختر خياراً واحداً على الأقل', pickQty:'اختر الكمية', notNow:'غير متوفر حالياً',
  tAdded:'تمت الإضافة إلى طلبك', tUpdated:'تم تحديث الطلب', tRemoved:'تمت الإزالة من طلبك', tCleared:'تم مسح الطلب',
  tDropped:'بعض المنتجات في طلبك لم تعد متوفرة وتمت إزالتها.',
  yourOrder:'طلبك', emptyT:'طلبك فارغ', emptyB:'اختر منتجاً ونكهاته وسيظهر هنا.', browse:'تصفّح المنتجات',
  fName:'اسمك', fNamePh:'الاسم للطلب', fAddr:'العنوان أو المنطقة (اختياري)', fAddrPh:'للتوصيل',
  fNotes:'ملاحظات (اختياري)', fNotesPh:'أي شيء نحتاج معرفته', fErr:'أضف اسمك لنعرف لمن الطلب.',
  seeMsg:'اطّلع على الرسالة التي سنرسلها', msgAria:'رسالة الطلب', copy:'نسخ الرسالة', copied:'تم نسخ الرسالة', waHelp:'لم يفتح واتساب؟ انسخ طلبك، افتح محادثتنا والصقه هناك.', copyOrder:'نسخ الطلب', openChat:'فتح المحادثة', fErrT:'أضف اسمك أولاً ثم أرسل.', copyFail:'حدّد النص وانسخه',
  cartPrice:function(p){ return p + ' للقطعة'; }, cartPriceWa:'السعر يُؤكَّد عبر واتساب',
  toConfirm:'يُؤكَّد لاحقاً', pendingWa:function(n){ return '+ ' + n + ' تُسعَّر عبر واتساب'; },
  send:'أرسل الطلب عبر واتساب', fine1:'سيُفتح طلبك في واتساب على الرقم', fine2:'. اضغط إرسال هناك لإتمامه.',
  clear:'مسح الطلب', clear2:'اضغط مجدداً لمسح الطلب كاملاً', opening:'جارٍ فتح واتساب. اضغط إرسال هناك لإتمام الطلب.',
  remove1:'إنقاص واحد', add1:'زيادة واحد', removeP:function(n){ return 'إزالة ' + n; },
  footOrders:'تُرسل الطلبات إلى واتساب على الرقم', chat:'تحدث معنا عبر واتساب',
  footPrices:'الأسعار بالدولار الأمريكي. نؤكد التوفر والسعر النهائي عبر واتساب.', footAge:'النيكوتين يسبب الإدمان. للبالغين 18 عاماً فما فوق فقط.',
  gateTxt:'يعرض هذا الكتالوج منتجات تحتوي على النيكوتين. يجب أن يكون عمرك 18 عاماً أو أكثر للدخول.', gateYes:'عمري 18 عاماً أو أكثر', gateNoBtn:'عمري أقل من 18',
  sorry:'عذراً', gateNo:'يجب أن يكون عمرك 18 عاماً أو أكثر لعرض هذا الكتالوج.',
  mHead:'*طلب جديد من كتالوج King Vape*', mName:'الاسم', mAddr:'العنوان', mOrder:'الطلب', mTotal:'المجموع', mPlus:function(n){ return '، وهناك ' + n + ' يُحدَّد سعرها لاحقاً'; },
  mTbc:'يُؤكَّد لاحقاً', mNotes:'ملاحظات',
  aTitle:'إدارة المنتجات', aSub:'يظهر هذا فقط لمن لديه صلاحية تعديل هذه الصفحة.', aSearch:'ابحث في المنتجات', aSoldOnly:'غير المتوفر فقط', aAdd:'إضافة منتج',
  aDiscard:'تجاهل التغييرات', aSave:function(n){ return n ? 'حفظ ونشر (' + n + ')' : 'حفظ ونشر'; },
  aNone:'لا توجد تغييرات', aUnsaved:function(n){ return n + ' (لم تُحفظ)'; }, aSaving:'جارٍ الحفظ…', aSaved:'تم الحفظ. تتم إعادة تحميل الصفحة.',
  aOn:'متوفر', aOff:'غير متوفر', aNew:'منتج جديد', aEdit:'تعديل', editThis:'تعديل المخزون والنكهات', aEmpty:'لا توجد منتجات مطابقة.',
  aName:'الاسم', aNameAr:'الاسم بالعربية (اختياري)', aCat:'الفئة', aSub2:'الفئة الفرعية', aPrice:'السعر بالدولار (فارغ = السعر عند الطلب)',
  aSpecs:'المواصفات، مفصولة بفواصل', aNote:'ملاحظة (بالإنجليزية)', aNoteAr:'ملاحظة (بالعربية)', aKind:'الخيارات هي', aKFlavor:'نكهات', aKColor:'ألوان', aKCombo:'تشكيلات نكهات',
  aPhoto:'الصورة', aChangePhoto:'تغيير الصورة', aPhotoHint:'الأفضل: صورة مربعة بخلفية شفافة أو سادة.', aUploading:'جارٍ الرفع…', aPhotoFail:'تعذّر رفع الصورة. جرّب صورة أصغر.',
  aOptions:'الخيارات', aPhFlavor:'مانجو آيس\nفراولة كيوي', aPhColor:'أسود\nفضي\nأزرق', aPhCombo:'مانجو + آيس\nتفاح + نعناع', aOptHint:'أوقف الخيار عندما ينفد.', aAllOn:'الكل متوفر', aAllOff:'الكل غير متوفر', aAddOpts:'أضف المزيد، واحد في كل سطر أو مفصولة بفواصل', aAddOptsBtn:'إضافة', aNoOpts:'لم تُضف أي نكهات أو ألوان، لذلك يختار الزبون الكمية فقط. أضفها أدناه ويصبح لكل واحدة مفتاح خاص بها لإيقافها عند نفادها.',
  aDelOpt:'حذف الخيار', aDelProd:'حذف المنتج', aDelProd2:'اضغط مجدداً للحذف', aNoSub:'بدون',
  aDefName:'منتج جديد', aNeedName:'أعطِ كل منتج جديد اسماً قبل الحفظ.',
  aRestore:'لم تُحفظ آخر تعديلاتك لأن شخصاً آخر نشر قبلك.', aRestoreBtn:'استعادة تعديلاتي', aDropBtn:'تجاهل',
  aErrReadOnly:'حسابك لا يستطيع حفظ هذه الصفحة. اطلب من المالك منحك صلاحية التعديل.', aErrConflict:'نشر شخص آخر قبلك. تتم إعادة تحميل الصفحة وتعديلاتك محفوظة لاستعادتها.',
  aErrRate:'عمليات حفظ كثيرة متتالية. انتظر دقيقة ثم حاول مجدداً.', aErrLarge:'الصفحة كبيرة جداً للحفظ. احذف بعض الصور أو استخدم صوراً أصغر.',
  aErrOff:'الحفظ غير متاح هنا.', aErrGeneric:'تعذّر الحفظ. حاول مجدداً.', aErrNoAdmin:'الحفظ غير متاح في هذه النسخة من الكتالوج.',
  aDirtyClose:'لديك تغييرات غير محفوظة. أغلق مجدداً لتركها.'
}};
/* plural forms: English [one, many]; Arabic [one, two, 3-10, 11+] */
var PL = {
  product:{ en:['product','products'], ar:['منتج واحد','منتجان','منتجات','منتجاً'] },
  item:{ en:['item','items'], ar:['قطعة واحدة','قطعتان','قطع','قطعة'] },
  flavor:{ en:['flavor','flavors'], ar:['نكهة واحدة','نكهتان','نكهات','نكهة'] },
  color:{ en:['color','colors'], ar:['لون واحد','لونان','ألوان','لوناً'] },
  combo:{ en:['combo','combos'], ar:['تشكيلة واحدة','تشكيلتان','تشكيلات','تشكيلة'] },
  change:{ en:['change','changes'], ar:['تغيير واحد','تغييران','تغييرات','تغييراً'] },
  option:{ en:['option','options'], ar:['خيار واحد','خياران','خيارات','خياراً'] }
};
var CATS = [
  { id:'devices', en:'Devices', ar:'الأجهزة', subs:[] },
  { id:'juices',  en:'Juices',  ar:'العصائر', subs:[{ id:'Freebase', en:'Freebase', ar:'فري بيس' }, { id:'Salt nicotine', en:'Salt nicotine', ar:'سولت نيكوتين' }] },
  { id:'puffs',   en:'Puffs',   ar:'السحبات', alt:'سحبات', subs:[{ id:'Normal puffs', en:'Normal puffs', ar:'سحبات عادية' }, { id:'Shisha puffs', en:'Shisha puffs', ar:'سحبات أرجيلة' }] }
];
var SPEC_AR = { 'Full kit':'طقم كامل', 'Kit':'طقم', 'Pod system':'نظام بود', 'Smart bluetooth':'بلوتوث ذكي', 'Device only':'الجهاز فقط', 'Pen cigarette style':'قلم بشكل سيجارة', 'Salt nicotine':'سولت نيكوتين', 'Freebase':'فري بيس' };
function trSpec(s){
  if (lang !== 'ar') return s;
  var m;
  if (SPEC_AR[s]) return SPEC_AR[s];
  if ((m = /^([\d,.]+) puffs$/.exec(s))) return m[1] + ' سحبة';
  if ((m = /^([\d,.]+) W$/.exec(s))) return m[1] + ' واط';
  if ((m = /^([\d,.]+) ml$/.exec(s))) return m[1] + ' مل';
  if ((m = /^([\d,.]+) mg nicotine$/.exec(s))) return 'نيكوتين ' + m[1] + ' ملغ';
  if ((m = /^([\d,.]+) mg$/.exec(s))) return m[1] + ' ملغ';
  if ((m = /^(\d+) flavors in one$/.exec(s))) return m[1] + ' نكهات في واحد';
  return s;
}
/* Arabic words people type, mapped to the English flavor words in the catalogue */
var ALIAS = {};
('مانجو=mango مانجا=mango منجا=mango بطيخ=watermelon عنب=grape فراولة=strawberry فريز=strawberry خوخ=peach دراق=peach تفاح=apple تفاحتين=double ' +
 'ليمون=lemon ليموناضة=lemonade نعنع=mint توت=berr موز=banana اناناس=pineapple كولا=cola كيوي=kiwi كرز=cherry شمام=melon ليتشي=lyche لتشي=lyche ' +
 'ثلج=ice مثلج=ice بارد=ice رمان=pomegranate جوافه=guava باشن=passion تنين=dragon علكه=gum تبغ=tobacco فانيليا=vanilla شاي=tea كابتشينو=cappuccino ' +
 'افوكادو=avocado كريمه=cream اسود=black احمر=red ازرق=blue وردي=pink ابيض=white اخضر=green بنفسجي=purple مشكل=mixed ميكس=mixed فواكه=fruit فاكهه=fruit ' +
 'استوائي=tropical ريد=red بول=bull كشمش=currant عليق=raz حامض=sour حلوى=candy كولد=cold جوز=coco').split(' ').forEach(function(p){ var a = p.split('='); ALIAS[fold(a[0])] = a[1]; });
function fold(s){
  return String(s).toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
}
function tokNorm(s){ return fold(s).replace(/^ال(?=.{3})/, ''); }
