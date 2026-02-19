import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const popbill = require('popbill');

const LinkID = process.env.POPBILL_LINK_ID;
const SecretKey = process.env.POPBILL_SECRET_KEY;
const IsTest = process.env.POPBILL_IS_TEST === 'true';

const taxinvoiceService = popbill.TaxinvoiceService(LinkID, SecretKey);

taxinvoiceService.IsTest = IsTest;
taxinvoiceService.IPRestrictOnOff = false;
taxinvoiceService.UseStaticIP = false;
taxinvoiceService.UseLocalTimeYN = true;

export { taxinvoiceService, popbill };
