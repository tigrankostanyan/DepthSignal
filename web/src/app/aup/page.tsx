'use client';

import React from 'react';
import Link from 'next/link';

export default function AupPage() {
  return (
    <div className="min-h-screen bg-primary text-main flex justify-center p-6">
      <div className="w-full max-w-[1600px] bg-[#0B1E33] border border-divider rounded-2xl p-6 md:p-10 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/login"
            className="text-muted hover:text-[#24C4E8] transition-colors text-sm"
          >
            ← Վերադառնալ
          </Link>
          <h1 className="text-2xl font-bold text-main">Ընդունելի օգտագործման քաղաքականություն</h1>
        </div>

        <div className="space-y-4 text-sm text-main leading-relaxed">
          <p className="text-muted">Արդյունավետ ամսաթիվ՝ Սեպտեմբերի 4, 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">1. Ներածություն</h2>
            <p>
              1.1. Սույն Ընդունելի օգտագործման քաղաքականությունը (այսուհետ՝ «Քաղաքականություն») սահմանում է MyScreener վեբ հավելվածի (այսուհետ՝ «Ծառայություն») օգտագործման թույլատրելի և արգելված ձևերը։
            </p>
            <p className="mt-2">
              1.2. Սույն Քաղաքականությունը հանդիսանում է Օգտագործման պայմանների անբաժանելի մասը։ Սույն Քաղաքականության խախտումը համարվում է Օգտագործման պայմանների խախտում։
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">2. Ընդհանուր կանոններ</h2>
            <p>
              2.1. Դուք պարտավոր եք Ծառայությունից օգտվել միայն օրինական նպատակներով։
            </p>
            <p className="mt-2">
              2.2. Դուք պարտավոր եք հարգել այլ օգտագործողների իրավունքները, գաղտնիությունը և անվտանգությունը։
            </p>
            <p className="mt-2">
              2.3. Դուք պարտավոր եք չխոչընդոտել Ծառայության բնականոն գործունեությունը։
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">3. Արգելված գործողությունների ցանկ</h2>

            <h3 className="text-base font-semibold text-[#24C4E8] mt-4">3.1. Չթույլատրված մուտք</h3>
            <p>Արգելվում է՝</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>փորձել մուտք գործել համակարգեր կամ տվյալներ, որոնց հասանելիություն չունեք.</li>
              <li>շրջանցել նույնականացման կամ մուտքի վերահսկման մեխանիզմները.</li>
              <li>օգտագործել այլ օգտագործողների հավատարմագրերը առանց թույլտվության։</li>
            </ul>

            <h3 className="text-base font-semibold text-[#24C4E8] mt-4">3.2. Բոտեր և ավտոմատացված սկրիպտներ</h3>
            <p>
              Արգելվում է Ծառայության հետ փոխազդող բոտերի, ավտոմատացված սկրիպտների կամ այլ ծրագրերի գործարկումը՝ առանց նախնական գրավոր թույլտվության։
            </p>

            <h3 className="text-base font-semibold text-[#24C4E8] mt-4">3.3. Տվյալների զանգվածային հավաքում</h3>
            <p>
              Արգելվում է Ծառայությունից տվյալների զանգվածային հավաքումը՝ scraping, crawling կամ այլ ավտոմատացված միջոցներով, ինչպես նաև Ծառայության բովանդակության վերարտադրումը կամ տարածումը առանց թույլտվության։
            </p>

            <h3 className="text-base font-semibold text-[#24C4E8] mt-4">3.4. Ծառայության խափանման փորձեր</h3>
            <p>Արգելվում է՝</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>սերվերների ծանրաբեռնման (DDoS) կամ նմանատիպ հարձակումների իրականացումը.</li>
              <li>Ծառայության, սերվերների կամ ցանցի բնականոն գործունեության խաթարումը.</li>
              <li>գաղտնաբառերի ընտրման (brute force) փորձերը։</li>
            </ul>

            <h3 className="text-base font-semibold text-[#24C4E8] mt-4">3.5. Վնասակար կոդի տարածում</h3>
            <p>
              Արգելվում է վիրուսների, որդերի, տրոյական ծրագրերի կամ այլ վնասակար կոդի տեղադրումը կամ տարածումը։
            </p>

            <h3 className="text-base font-semibold text-[#24C4E8] mt-4">3.6. Բովանդակության չարաշահում</h3>
            <p>Արգելվում է՝</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>ապօրինի, զրպարտչող, վիրավորական, սպառնացող կամ խտրական բովանդակության տեղադրումը.</li>
              <li>ուրիշների մտավոր սեփականության իրավունքների խախտումը.</li>
              <li>խարդախ կամ ապակողմնորոշող գործողությունների իրականացումը։</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">4. Հետևանքներ</h2>
            <p>
              4.1. Սույն Քաղաքականության խախտման դեպքում մենք կարող ենք կիրառել հետևյալ միջոցները՝
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>նախազգուշացում.</li>
              <li>հասանելիության ժամանակավոր արգելափակում.</li>
              <li>հաշվի մշտական դադարեցում՝ առանց նախազգուշացման։</li>
            </ul>
            <p className="mt-2">
              4.2. Ծանր խախտումների դեպքում՝ ներառյալ չթույլատրված մուտքի փորձերը, brute force հարձակումները, տվյալների զանգվածային հավաքումը, Ծառայության խափանման փորձերը կամ վնասակար կոդի տարածումը, մենք իրավունք ունենք անհապաղ, առանց նախազգուշացման դադարեցնելու ձեր հասանելիությունը։
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">5. Խախտումների արձանագրում և ապացույցների պահպանում</h2>
            <p>
              5.1. Մենք իրավունք ունենք գրանցելու և պահպանելու սույն Քաղաքականության խախտումների հետ կապված բոլոր ապացույցները՝ ներառյալ IP հասցեները, ժամանակային դրոշմները, գրանցամատյանները և տեխնիկական տվյալները։
            </p>
            <p className="mt-2">
              5.2. Նման ապացույցները կարող են օգտագործվել իրավական հետապնդման համար կամ տրամադրվել իրավապահ մարմիններին։
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">6. Բողոքարկման գործընթաց</h2>
            <p>
              6.1. Եթե համարում եք, որ ձեր հասանելիությունը դադարեցվել կամ արգելափակվել է սխալմամբ, կարող եք բողոք ներկայացնել՝ դիմելով սույն Քաղաքականության 7-րդ բաժնում նշված կոնտակտներով։
            </p>
            <p className="mt-2">
              6.2. Մենք կքննարկենք ձեր բողոքը ողջամիտ ժամկետում և կտրամադրենք պատասխան։
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">7. Կոնտակտային տվյալներ</h2>
            <p>
              Սույն Քաղաքականության վերաբերյալ հարցերի դեպքում դիմեք՝
              <br />
              <a href="mailto:support@myscreener.com" className="text-[#24C4E8] hover:underline font-medium">
                support@myscreener.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}