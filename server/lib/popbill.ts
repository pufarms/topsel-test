const popbill = require("popbill");

const LinkID = process.env.POPBILL_LINK_ID || '';
const SecretKey = process.env.POPBILL_SECRET_KEY || '';
const IsTest = process.env.POPBILL_IS_TEST === 'true';

popbill.config({
  LinkID: LinkID,
  SecretKey: SecretKey,
  IsTest: IsTest,
  IPRestrictOnOff: false,
  UseStaticIP: false,
  UseLocalTimeYN: true,
});

const taxinvoiceService = popbill.TaxinvoiceService();

console.log(`[팝빌] SDK 초기화 완료 (LinkID=${LinkID ? LinkID.substring(0, 2) + '**' : '(미설정)'}, IsTest=${IsTest}, ServiceURL=${taxinvoiceService.ServiceURL || ''})`);

export { taxinvoiceService, popbill };
