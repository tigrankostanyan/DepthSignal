'use client';

import React from 'react';
import Link from 'next/link';

export default function CookiesPage() {
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
          <h1 className="text-2xl font-bold text-main">Cookie-ների քաղաքականություն</h1>
        </div>

        <div className="space-y-4 text-sm text-main leading-relaxed">
          <p className="text-muted">Արդյունավետ ամսաթիվ՝ Սեպտեմբերի 4, 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">1. Ինչ են cookie-ները</h2>
            <p>
              1.1. Cookie-ները փոքր տեքստային ֆայլեր են, որոնք պահվում են ձեր սարքում՝ MyScreener վեբ հավելվածը (այսուհետ՝ «Ծառայություն») այցելելիս։ Դրանք օգնում են Ծառայությանը ճանաչել ձեր սարքը, հիշել ձեր նախընտրությունները և բարելավել օգտագործման փորձը։
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">2. Ինչ տեսակի cookie-ներ ենք օգտագործում</h2>

            <h3 className="text-base font-semibold text-[#24C4E8] mt-4">2.1. Խիստ անհրաժեշտ cookie-ներ</h3>
            <p>
              Այս cookie-ներն անհրաժեշտ են Ծառայության հիմնական գործառույթների համար, ինչպիսիք են նույնականացումը և անվտանգության ապահովումը։ Դրանք չեն կարող անջատվել։
            </p>

            <h3 className="text-base font-semibold text-[#24C4E8] mt-4">2.2. Ֆունկցիոնալ cookie-ներ</h3>
            <p>
              Այս cookie-ները հիշում են ձեր նախընտրությունները և բարելավում են օգտագործման փորձը։
            </p>

            <h3 className="text-base font-semibold text-[#24C4E8] mt-4">2.3. Վերլուծական (analytics) cookie-ներ</h3>
            <p>
              Այս cookie-ները օգնում են մեզ հասկանալ, թե ինչպես են օգտագործողները փոխազդում Ծառայության հետ՝ վերլուծելով այցելությունների վիճակագրությունը։
            </p>

            <h3 className="text-base font-semibold text-[#24C4E8] mt-4">2.4. Գովազդային cookie-ներ</h3>
            <p>
              Այս cookie-ներն օգտագործվում են ձեր հետաքրքրություններին համապատասխան գովազդ ցուցադրելու համար։
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">3. Ինչպես կառավարել cookie-ները</h2>
            <p>
              3.1. Դուք կարող եք կառավարել կամ ջնջել cookie-ները ձեր բրաուզերի կարգավորումների միջոցով։
            </p>
            <p className="mt-2">
              3.2. Խիստ անհրաժեշտ cookie-ների անջատումը կարող է հանգեցնել Ծառայության որոշ գործառույթների չաշխատելուն։
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">4. Երրորդ կողմի cookie-ներ</h2>
            <p>
              4.1. Ծառայությունը կարող է օգտագործել երրորդ կողմի ծառայություններ (օր.՝ վերլուծական գործիքներ), որոնք տեղադրում են իրենց սեփական cookie-ները։ Նման cookie-ները կարգավորվում են համապատասխան երրորդ կողմերի քաղաքականություններով։
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">5. Փոփոխություններ այս քաղաքականության մեջ</h2>
            <p>
              5.1. Մենք կարող ենք թարմացնել սույն Քաղաքականությունը ցանկացած ժամանակ՝ հրապարակելով թարմացված տարբերակը՝ նոր արդյունավետ ամսաթվով։
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6">6. Կոնտակտային տվյալներ</h2>
            <p>
              Սույն Cookie-ների քաղաքականության վերաբերյալ հարցերի դեպքում դիմեք՝
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