/* ==========================================================================
   La Librairie — app.js
   Google Books API를 활용한 클라이언트 사이드 도서 검색 / AI 맞춤 추천 /
   상세보기 / 리뷰(평점) 기능을 제공합니다.

   ★ API 키 설정 방법 ★
   아래 GOOGLE_API_KEY 에 Google Books API 키를 넣으면 훨씬 안정적입니다.
   (무료 키 발급: https://console.cloud.google.com → Books API 사용 설정)
   키가 없어도 동작하지만, 잦은 검색 시 일시 차단될 수 있습니다.
   ========================================================================== */

(function () {
  "use strict";

  /* ▼ 여기에 Google Books API 키를 입력하세요 (없으면 빈 문자열 "") */
  var GOOGLE_API_KEY = "";

  /* -------------------------------------------------------------------------
   * 0. 자체 서재 데이터베이스 (104권) - 오프라인 검색 및 AI 큐레이션용
   * ----------------------------------------------------------------------- */
  var LOCAL_BOOKS = [
    // === 소설 ===
    {
      id: "local-1",
      title: "데미안",
      authors: "헤르만 헤세",
      publisher: "민음사",
      publishedDate: "1919-06-01",
      description: "청년 싱클레어가 어두운 세계의 유혹을 이겨내고 참된 자아를 찾아가는 과정을 그린 성장 소설의 고전. 알을 깨고 나오려는 투쟁을 은유적으로 묘사하여 깊은 울림을 줍니다.",
      categories: ["소설"],
      thumbnail: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=데미안"
    },
    {
      id: "local-2",
      title: "위대한 개츠비",
      authors: "F. 스콧 피츠제럴드",
      publisher: "문학동네",
      publishedDate: "1925-04-10",
      description: "1920년대 미국의 화려함 뒤에 숨겨진 인간의 헛된 욕망과 한 남자의 순수한 사랑을 그린 소설. 물질문명 속에서 피어난 한 줌의 로맨티시즘을 서정적으로 표현했습니다.",
      categories: ["소설"],
      thumbnail: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=위대한+개츠비"
    },
    {
      id: "local-3",
      title: "1984",
      authors: "조지 오웰",
      publisher: "민음사",
      publishedDate: "1949-06-08",
      description: "극단적 전체주의 사회인 오세아니아에서 당의 통제에 맞서 인간의 존엄성을 지키려는 주인공 윈스턴 스미스의 처절한 투쟁을 그린 디스토피아 문학의 대표작입니다.",
      categories: ["소설", "SF/판타지"],
      thumbnail: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=1984"
    },
    {
      id: "local-4",
      title: "불편한 편의점",
      authors: "김호연",
      publisher: "나무옆의자",
      publishedDate: "2021-04-20",
      description: "서울 청파동의 작은 편의점을 배경으로, 독특한 야간 알바생 '독고'와 그곳을 찾는 이웃들의 삶을 다정하게 감싸 안는 따뜻한 연작 소설입니다.",
      categories: ["소설", "자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=불편한+편의점"
    },
    {
      id: "local-5",
      title: "이방인",
      authors: "알베르 카뮈",
      publisher: "민음사",
      publishedDate: "1942-06-15",
      description: "현실의 부조리 속에서 타협하기보다 진실만을 고집하다 파멸해가는 젊은 뫼르소의 삶을 통해 인간 존재의 의미를 묻는 실존주의 소설의 고전.",
      categories: ["소설", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.5,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=이방인"
    },
    {
      id: "local-6",
      title: "호밀밭의 파수꾼",
      authors: "J.D. 샐린저",
      publisher: "민음사",
      publishedDate: "1951-07-16",
      description: "학교에서 퇴학당한 16세 소년 홀든 콜필드가 겪는 이틀간의 방황을 통해 기성세대의 위선과 타락을 냉소적이고도 섬세하게 포착한 청춘의 필독서.",
      categories: ["소설"],
      thumbnail: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.4,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=호밀밭의+파수꾼"
    },
    {
      id: "local-7",
      title: "그리스인 조르바",
      authors: "니코스 카잔차키스",
      publisher: "열린책들",
      publishedDate: "1946-10-01",
      description: "어떤 제약과 속박에도 얽매이지 않고 자유롭게 살아가는 자유인 조르바의 호탕한 삶과 생각을 통해 참다운 자유와 영혼의 해방을 제시합니다.",
      categories: ["소설", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=그리스인+조르바"
    },
    {
      id: "local-8",
      title: "토지",
      authors: "박경리",
      publisher: "다산책방",
      publishedDate: "1969-09-01",
      description: "구한말부터 광복까지 격동의 한국 근현대사를 배경으로 평사리 최참판댁 일가의 몰락과 재건을 둘러싼 인물들의 운명을 그린 대하소설의 금자탑.",
      categories: ["소설", "역사"],
      thumbnail: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.9,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=토지"
    },
    {
      id: "local-9",
      title: "채식주의자",
      authors: "한강",
      publisher: "창비",
      publishedDate: "2007-10-30",
      description: "육식으로 상징되는 폭력을 단호하게 거부하고 채식을 선언하면서 서서히 스러져가는 한 여성의 삶을 세 사람의 시선에서 섬세하고 서늘하게 관조합니다.",
      categories: ["소설"],
      thumbnail: "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=채식주의자"
    },
    {
      id: "local-10",
      title: "아몬드",
      authors: "손원평",
      publisher: "창비",
      publishedDate: "2017-03-31",
      description: "감정 표현 불능증을 앓아 기쁨도, 분노도 느끼지 못하는 소년 윤재가 무뚝뚝하지만 따뜻한 주변인들과 어우러져 성장하고 소통해가는 감동적인 이야기.",
      categories: ["소설", "자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=아몬드"
    },
    {
      id: "local-11",
      title: "달러구트 꿈 백화점",
      authors: "이미예",
      publisher: "팩토리나인",
      publishedDate: "2020-07-08",
      description: "온갖 종류의 꿈을 판매하는 백화점이라는 판타지적 설정을 바탕으로, 현실에 지친 손님들이 밤하늘의 은하수처럼 빛나는 꿈을 꾸며 위로와 깨달음을 얻는 힐링 소설.",
      categories: ["소설", "SF/판타지"],
      thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=달러구트+꿈+백화점"
    },
    {
      id: "local-12",
      title: "동물농장",
      authors: "조지 오웰",
      publisher: "민음사",
      publishedDate: "1945-08-17",
      description: "매너 농장의 동물들이 인간 주인을 쫓아내고 혁명을 일으켜 '동물 공화국'을 세우지만, 권력을 쥔 돼지들이 부패하여 또 다른 지배자로 군림하는 풍자적 우화 소설.",
      categories: ["소설"],
      thumbnail: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=동물농장"
    },
    {
      id: "local-13",
      title: "노인과 바다",
      authors: "어니스트 헤밍웨이",
      publisher: "민음사",
      publishedDate: "1952-09-01",
      description: "고독한 노인 산티아고가 84일간의 불어닥친 허탕 끝에 거대한 청새치와 사투를 벌이고, 마지막까지 포기하지 않는 의연함과 용기를 통해 인간 존엄성을 승화시킨 소설.",
      categories: ["소설"],
      thumbnail: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=노인과+바다"
    },

    // === 인문/철학 ===
    {
      id: "local-14",
      title: "미움받을 용기",
      authors: "기시미 이치로, 고가 후미타케",
      publisher: "인플루엔셜",
      publishedDate: "2014-11-17",
      description: "알프레드 아들러의 오스트리아식 개인 심리학을 청년과 철학자의 깊이 있는 대화 형식으로 쉽게 풀어내어 타인의 기대에 부응하느라 나를 잃어가는 현대인들에게 자립의 해법을 제시합니다.",
      categories: ["인문/철학", "자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=미움받을+용기"
    },
    {
      id: "local-15",
      title: "사피엔스",
      authors: "유발 하라리",
      publisher: "김영사",
      publishedDate: "2011-09-04",
      description: "동아프리카 구석의 유인원에서 과학문명을 정복하고 지구의 신이 되기까지의 기나긴 인류 문명 발전 단계를 농업혁명, 인지혁명, 과학혁명을 축으로 예리하게 밝혀낸 통섭적 명저.",
      categories: ["인문/철학", "역사", "과학/IT"],
      thumbnail: "https://images.unsplash.com/photo-1474932430478-367dbb6832c1?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=사피엔스"
    },
    {
      id: "local-16",
      title: "니체의 말",
      authors: "프리드리히 니체 (시라토리 하루히코 편)",
      publisher: "삼호미디어",
      publishedDate: "2010-09-15",
      description: "기존의 가치관을 뒤집고 고결한 초인의 삶을 추구하며 스스로를 끊임없이 단련하라고 외친 니체의 232가지 주옥같은 사상을 짧은 문구와 시적인 여운으로 담아낸 아포리즘집.",
      categories: ["인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.5,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=니체의+말"
    },
    {
      id: "local-17",
      title: "정의란 무엇인가",
      authors: "마이클 샌델",
      publisher: "와이즈베리",
      publishedDate: "2009-09-15",
      description: "공동체주의와 도덕성 회복이라는 화두를 던지며 최대다수의 최대행복, 자유지상주의, 공동체 덕목 등의 관점으로 복잡한 정의의 딜레마를 함께 고민하도록 유도합니다.",
      categories: ["인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=정의란+무엇인가"
    },
    {
      id: "local-18",
      title: "소크라테스의 변명",
      authors: "플라톤",
      publisher: "스타북스",
      publishedDate: "2015-05-10",
      description: "사형 선고를 눈앞에 둔 재판정에서도 진리와 지혜를 향한 철학적 탐구를 멈추지 않고 인간다운 삶의 윤리적 기준을 역설했던 스승 소크라테스의 마지막 증언을 묘사한 불후의 고전.",
      categories: ["인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1513001900722-370f803f498d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=소크라테스의+변명"
    },
    {
      id: "local-19",
      title: "군주론",
      authors: "니콜로 마키아벨리",
      publisher: "까치",
      publishedDate: "1513-01-01",
      description: "도덕주의적 정치 환상에서 벗어나 국가의 안전과 군주의 권력 유지를 위해 현실적이고도 때로는 가혹한 정치적 수완이 필요함을 예리하게 지적한 근대 현실정치사상의 정수.",
      categories: ["인문/철학", "역사"],
      thumbnail: "https://images.unsplash.com/photo-1508780709619-79562469964d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.4,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=군주론"
    },
    {
      id: "local-20",
      title: "자유론",
      authors: "존 스튜어트 밀",
      publisher: "문예출판사",
      publishedDate: "1859-01-01",
      description: "다수의 횡포로부터 개인의 사상과 표현, 행동의 자유를 어디까지 보호받아야 하는지에 대한 논증을 바탕으로 타인에게 해를 끼치지 않는 한 절대적인 개인의 자율을 옹호한 자유주의의 성서.",
      categories: ["인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1550399105-c4dbb6779758?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=자유론"
    },
    {
      id: "local-21",
      title: "감시와 처벌",
      authors: "미셸 푸코",
      publisher: "나남",
      publishedDate: "1975-02-01",
      description: "감옥의 역사와 신체 형벌에서 정신 규율로의 변화 과정을 조망하며, 현대 권력이 판옵티콘 구조처럼 어떻게 인간의 신체와 행동을 교묘하게 통제하고 감시하는지 규명한 역작.",
      categories: ["인문/철학", "역사"],
      thumbnail: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=감시와+처벌"
    },
    {
      id: "local-22",
      title: "사랑의 기술",
      authors: "에리히 프롬",
      publisher: "문예출판사",
      publishedDate: "1956-01-01",
      description: "사랑을 우연한 감정의 폭발이 아니라 훈련과 노력이 필요한 고도의 '기술'이자 행동양식으로 규정하고, 현대 사회에서 건강한 상호 존중과 자아 실현을 이루는 사랑에 대해 고찰합니다.",
      categories: ["인문/철학", "자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=사랑의+기술"
    },
    {
      id: "local-23",
      title: "차라투스트라는 이렇게 말했다",
      authors: "프리드리히 니체",
      publisher: "민음사",
      publishedDate: "1883-01-01",
      description: "신은 죽었다는 도발적인 선언 아래, 인간을 억압하는 낡은 도덕적 가치와 영원회귀 사상을 넘어서 끊임없이 영혼을 극복해가는 초인(Übermensch)의 길을 서사적 비유와 상징으로 그려낸 철학시.",
      categories: ["인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=차라투스트라는+이렇게+말했다"
    },
    {
      id: "local-24",
      title: "지적 대화를 위한 넓고 얕은 지식 1",
      authors: "채사장",
      publisher: "한빛비즈",
      publishedDate: "2014-12-15",
      description: "역사, 경제, 정치, 사회, 윤리 등 복잡하게 얽혀 있는 인류 문명 발전 과정을 현실과 초현실이라는 간결한 구조를 바탕으로 누구나 쉽게 상식의 눈을 뜰 수 있게 해주는 인문 입문서.",
      categories: ["인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=지대넓얕"
    },
    {
      id: "local-25",
      title: "삶을 위한 철학 수업",
      authors: "이진우",
      publisher: "휴머니스트",
      publishedDate: "2015-09-07",
      description: "삶의 위기와 불안 앞에서 상실감을 느끼는 현대인들이 어떻게 가치의 기준을 바로 세우고 마음의 평온을 찾을 수 있을지 여러 철학자들의 통찰 어린 해답을 건네줍니다.",
      categories: ["인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.5,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=삶을+위한+철학+수업"
    },
    {
      id: "local-26",
      title: "돈의 철학",
      authors: "임석민",
      publisher: "서해문집",
      publishedDate: "2020-03-23",
      description: "화폐와 자본이 지배하는 이 사회 속에서 물질적 탐욕에 흔들리지 않고 인생의 본질적인 행복과 정신적 충족을 지킬 수 있는 가치관 정립의 철학적 통찰.",
      categories: ["인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.4,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=돈의+철학"
    },

    // === 역사 ===
    {
      id: "local-27",
      title: "총, 균, 쇠",
      authors: "재레드 다이아몬드",
      publisher: "문학사상",
      publishedDate: "1997-03-01",
      description: "왜 각 대륙의 인류 발전 속도가 차이가 날 수밖에 없었는가? 환경이 역사에 미친 결정적 생태학적 근원을 파헤쳐 인종주의적 편견을 허물어뜨린 기념비적 문명사 서적.",
      categories: ["역사", "인문/철학", "과학/IT"],
      thumbnail: "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=총균쇠"
    },
    {
      id: "local-28",
      title: "역사의 쓸모",
      authors: "최태성",
      publisher: "다산초당",
      publishedDate: "2019-06-21",
      description: "역사 속 수많은 선조들의 선택과 삶을 통해 오늘날 우리가 마주한 다양한 고민들을 어떻게 헤쳐나가고, 삶을 가치 있게 채울 수 있는지 다독여 주는 한국사 에세이.",
      categories: ["역사", "자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=역사의+쓸모"
    },
    {
      id: "local-29",
      title: "역사란 무엇인가",
      authors: "E.H. 카",
      publisher: "까치글방",
      publishedDate: "1961-10-01",
      description: "역사는 과거와 현재와의 끊임없는 대화이다. 역사가가 객관적 사료를 수집하고 어떻게 주체적으로 재해석하여 미래 사회에 의미를 더하는지 논증한 역사학의 경전.",
      categories: ["역사"],
      thumbnail: "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=역사란+무엇인가"
    },
    {
      id: "local-30",
      title: "백범일지",
      authors: "김구",
      publisher: "돌베개",
      publishedDate: "1947-11-15",
      description: "대한민국 임시정부 주석 백범 김구 선생이 아들들에게 전하는 유서이자 나라의 독립을 위해 몸 바쳤던 일생의 흔적이 고스란히 묻어나는 우리 민족의 현대사 자서전.",
      categories: ["역사"],
      thumbnail: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=백범일지"
    },
    {
      id: "local-31",
      title: "삼국유사",
      authors: "일연",
      publisher: "을유문화사",
      publishedDate: "1281-01-01",
      description: "삼국사기에 수록되지 않은 고대 전설과 향가, 건국 신화, 불교 일화 등을 충실히 수집하여 민족의 뿌리와 자주적 얼을 일깨워 주는 신화적 보물창고.",
      categories: ["역사"],
      thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=삼국유사"
    },
    {
      id: "local-32",
      title: "로마인 이야기",
      authors: "시오노 나나미",
      publisher: "한길사",
      publishedDate: "1992-07-01",
      description: "역사상 가장 방대한 제국을 세우고 공존과 통합의 리더십을 발휘했던 로마인들의 천년 역사와 전쟁, 법치 체계를 흥미롭고 극적인 서사로 그려낸 역사 논픽션.",
      categories: ["역사"],
      thumbnail: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.5,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=로마인+이야기"
    },
    {
      id: "local-33",
      title: "징비록",
      authors: "류성룡",
      publisher: "서해문집",
      publishedDate: "1604-01-01",
      description: "임진왜란이라는 뼈아픈 역사를 겪은 서애 류성룡 대감이 참화를 겪으며 다시는 같은 참극을 겪지 않도록 후세를 경계하며 남겨둔 전란의 생생한 반성록이자 정책서.",
      categories: ["역사"],
      thumbnail: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=징비록"
    },
    {
      id: "local-34",
      title: "나의 문화유산답사기",
      authors: "유홍준",
      publisher: "창비",
      publishedDate: "1993-05-01",
      description: "아는 만큼 보인다. 전국 각지의 문화유산 속에 숨겨져 있는 예술적 멋과 역사 속 백성들의 정서를 해학적이고도 박식한 문체로 전해주는 답사 에세이의 전설.",
      categories: ["역사", "시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=나의+문화유산답사기"
    },
    {
      id: "local-35",
      title: "사기 본기",
      authors: "사마천",
      publisher: "민음사",
      publishedDate: "-0091-01-01",
      description: "궁형이라는 처절한 굴욕 속에서도 역사 기록을 향한 집념으로 중국 황제들의 흥망성쇠를 극적이고 인간성 넘치는 문체로 서술해 낸 기전체 역사의 시초.",
      categories: ["역사", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1474932430478-367dbb6832c1?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=사기+본기"
    },
    {
      id: "local-36",
      title: "조선왕조실록",
      authors: "박영규",
      publisher: "웅진지식하우스",
      publishedDate: "1996-03-01",
      description: "태조부터 철종까지 472년 동안 정사를 철저히 붓끝으로 남겨 세계기록유산에 등재된 실록을 한 권으로 보기 쉽게 정리해 조선의 역동적인 왕실사를 들려줍니다.",
      categories: ["역사"],
      thumbnail: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=조선왕조실록"
    },
    {
      id: "local-37",
      title: "난중일기",
      authors: "이순신",
      publisher: "서해문집",
      publishedDate: "1598-01-01",
      description: "임진왜란 동안 충무공 이순신 장군이 바다 위의 전쟁 상황과 진중에서의 외로움, 고뇌, 애국심을 고스란히 담아 붓으로 남긴 절절한 일기장이자 국가 보물.",
      categories: ["역사"],
      thumbnail: "https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.9,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=난중일기"
    },
    {
      id: "local-38",
      title: "세계사 편력",
      authors: "자와할랄 네루",
      publisher: "일빛",
      publishedDate: "1934-01-01",
      description: "인도 독립 영웅 네루가 옥중에서 어린 딸 인디라 간디에게 세계의 문명 교류와 역사의 흐름을 따뜻하고 지혜 가득한 편지로 써 내린 방대한 편지 에세이.",
      categories: ["역사", "시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1513001900722-370f803f498d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=세계사+편력"
    },
    {
      id: "local-39",
      title: "21세기를 위한 21가지 제언",
      authors: "유발 하라리",
      publisher: "김영사",
      publishedDate: "2018-09-04",
      description: "가짜 뉴스, 인공지능, 테러리즘, 탈진실의 시대에서 인류가 나아가야 할 올바른 태도와 존재론적 성찰을 21가지 질문으로 깊이 분석한 문명 미래서.",
      categories: ["역사", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1508780709619-79562469964d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=21세기를+위한+21가지+제언"
    },

    // === 과학/IT ===
    {
      id: "local-40",
      title: "코스모스",
      authors: "칼 세이건",
      publisher: "사이언스북스",
      publishedDate: "1980-10-01",
      description: "우주의 탄생과 인류의 기원, 문명의 소멸을 우아하고 서정적이며 깊은 경외심으로 써 내려간 전설적인 천문학의 대중 교양서이자 생태학적 고백.",
      categories: ["과학/IT", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1550399105-c4dbb6779758?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.9,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=코스모스"
    },
    {
      id: "local-41",
      title: "물고기는 존재하지 않는다",
      authors: "룰루 밀러",
      publisher: "곰출판",
      publishedDate: "2020-04-14",
      description: "자연에 억지 질서를 부여하려던 집착 넘친 과학자의 파란만장한 일생과 실연을 극복해가는 저자 자신의 상실이 엮여 혼돈이 가득한 삶에 경종을 울리는 과학 에세이.",
      categories: ["과학/IT", "소설", "시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=물고기는+존재하지+않는다"
    },
    {
      id: "local-42",
      title: "이기적 유전자",
      authors: "리처드 도킨스",
      publisher: "을유문화사",
      publishedDate: "1976-10-01",
      description: "인간을 포함한 모든 생명체는 유전자의 생존과 복제를 위한 정교한 운반 생존 기계일 뿐이라는 도발적 다윈주의 해석을 통해 진화의 주체가 개체가 아닌 유전자임을 규명한 책.",
      categories: ["과학/IT", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=이기적+유전자"
    },
    {
      id: "local-43",
      title: "정재승의 과학 콘서트",
      authors: "정재승",
      publisher: "어크로스",
      publishedDate: "2001-07-20",
      description: "복잡계 물리학과 카오스 이론의 원리를 백화점 배치, 신호등 등 우리 실생활 속 흥미로운 현상들과 연결하여 대중에게 물리학의 재미를 선사해주는 현대 교양과학서.",
      categories: ["과학/IT"],
      thumbnail: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=과학+콘서트"
    },
    {
      id: "local-44",
      title: "아내를 모자로 착각한 아내",
      authors: "올리버 색스",
      publisher: "알마",
      publishedDate: "1985-01-01",
      description: "기묘한 뇌 장애와 정신 질환을 앓고 있는 환자들을 차가운 임상 대상이 아닌, 자신만의 존엄한 영혼을 가진 독특한 존재들로 바라보며 인문학적 치유의 시선을 던진 정신의학 논픽션.",
      categories: ["과학/IT", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=아내를+모자로+착각한+아내"
    },
    {
      id: "local-45",
      title: "시간의 역사",
      authors: "스티븐 호킹",
      publisher: "까치",
      publishedDate: "1988-04-01",
      description: "빅뱅 이론에서 블랙홀 이론, 웜홀, 끈 이론을 아우르며, 우주와 시간의 시작과 미래를 향한 물리학자 스티븐 호킹의 위대한 통찰을 대중적 언어로 기술한 최고의 과학 교양서.",
      categories: ["과학/IT"],
      thumbnail: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=시간의+역사"
    },
    {
      id: "local-46",
      title: "침묵의 봄",
      authors: "레이첼 카슨",
      publisher: "에코리브르",
      publishedDate: "1962-09-27",
      description: "DDT와 같은 무분별한 화학 살충제 남용이 어떻게 자연 생태계를 교란하고 봄의 새소리를 앗아가는지 경고하여, 현대 환경 보호 운동과 환경 단체의 출범을 이끌어 낸 생태학의 기념비.",
      categories: ["과학/IT", "역사"],
      thumbnail: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=침묵의+봄"
    },
    {
      id: "local-47",
      title: "부분과 전체",
      authors: "베르너 하이젠베르크",
      publisher: "지식산업사",
      publishedDate: "1969-01-01",
      description: "양자역학의 거장 하이젠베르크가 철학자, 물리학자 동료들과 우주와 인간, 정치에 대해 끊임없이 나눈 대화 기록을 통해, 과학적 부분과 생의 전체의 관계를 규명한 명저.",
      categories: ["과학/IT", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=부분과+전체"
    },
    {
      id: "local-48",
      title: "수학의 쓸모",
      authors: "닉 폴슨, 제임스 스콧",
      publisher: "더퀘스트",
      publishedDate: "2020-04-17",
      description: "알고리즘, 인공지능, 자율주행의 핵심 도구가 된 베이즈 규칙과 조건부 확률 이론 등 현대 정보 기술 밑바탕에 흐르는 실용적이고도 경이로운 수학적 응용력을 보여줍니다.",
      categories: ["과학/IT"],
      thumbnail: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.5,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=수학의+쓸모"
    },
    {
      id: "local-49",
      title: "링크드",
      authors: "알버트 라슬로 바라바시",
      publisher: "동아시아",
      publishedDate: "2002-05-01",
      description: "세포 단백질망에서 테러 조직망, 인터넷까지 우리 세계의 수많은 복잡한 관계망들이 '척도 없는 네트워크'라는 간결한 수학 법칙으로 상호 연결되어 있음을 밝혀낸 혁신적인 과학 책.",
      categories: ["과학/IT"],
      thumbnail: "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=링크드"
    },
    {
      id: "local-50",
      title: "특이점이 온다",
      authors: "레이 커즈와일",
      publisher: "김영사",
      publishedDate: "2005-09-01",
      description: "인공지능과 나노 기술, 생명공학의 비약적 수확 가속의 법칙으로 인해 인류의 생물학적 한계를 돌파하고 기계 인공지능이 인간 지능을 영원히 넘어서는 순간인 '특이점'을 내다봅니다.",
      categories: ["과학/IT", "SF/판타지"],
      thumbnail: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.5,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=특이점이+온다"
    },
    {
      id: "local-51",
      title: "호모 데우스",
      authors: "유발 하라리",
      publisher: "김영사",
      publishedDate: "2015-09-04",
      description: "기아와 전염병, 전쟁을 통제하게 된 사피엔스가 이제 영생และ 행복, 신성이라는 신적인 영역을 갈망하며 '호모 데우스'로 도약할 것인가, 혹은 데이터 전능주의 아래 종말을 고할 것인가 질문합니다.",
      categories: ["과학/IT", "인문/철학", "역사"],
      thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=호모+데우스"
    },
    {
      id: "local-52",
      title: "알고리즘, 인생을 계산하다",
      authors: "브라이언 크리스천, 톰 그리피스",
      publisher: "청림출판",
      publishedDate: "2016-04-12",
      description: "언제 집을 구해야 하는지, 물건을 어떻게 정렬해야 하는지 등 컴퓨터 과학의 강력한 알고리즘을 인간 인생의 최적 선택과 결정의 지혜로 활용하는 매혹적인 방법론.",
      categories: ["과학/IT", "자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=알고리즘+인생을+계산하다"
    },

    // === 시/에세이 ===
    {
      id: "local-53",
      title: "하늘과 바람과 별과 시",
      authors: "윤동주",
      publisher: "스타북스",
      publishedDate: "1948-01-30",
      description: "일제강점기 어두운 조국의 그림자 속에서도 하늘을 우러러 한 점 부끄럼 없기를 갈망했던 시인 윤동주의 순수한 성찰과 맑고 애틋한 서정성이 깃든 유고 시집.",
      categories: ["시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.9,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=하늘과+바람과+별과+시"
    },
    {
      id: "local-54",
      title: "여행의 이유",
      authors: "김영하",
      publisher: "문학동네",
      publishedDate: "2019-04-17",
      description: "작가가 평생 동안 헤맸던 수많은 여행 속 만남과 상처, 인생에 대한 애틋한 사색을 조용하고 매력적인 소설가의 예리한 안목으로 써 내려간 에세이집.",
      categories: ["시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=여행의+이유"
    },
    {
      id: "local-55",
      title: "보노보노처럼 살다니 다행이야",
      authors: "김신회",
      publisher: "놀",
      publishedDate: "2017-04-05",
      description: "느려도 괜찮아, 서툴러도 나답게 살아갈 수 있어. 귀여운 동물 캐릭터 보노보노와 그 숲속 친구들의 단순하고도 철학적인 대사들로부터 건져 올린 어른을 위한 위로법.",
      categories: ["시/에세이", "자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1474932430478-367dbb6832c1?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=보노보노처럼+살다니+다행이야"
    },
    {
      id: "local-56",
      title: "언어의 온도",
      authors: "이기주",
      publisher: "말글터",
      publishedDate: "2016-08-19",
      description: "말과 글에는 각자의 따뜻함과 차가움이 있다. 바쁜 삶의 모퉁이에서 만난 평범한 이웃들의 따스한 언어들을 수집하여 상처 입은 마음에 포근한 위안을 불어넣습니다.",
      categories: ["시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=언어의+온도"
    },
    {
      id: "local-57",
      title: "꽃을 보듯 너를 본다",
      authors: "나태주",
      publisher: "지혜",
      publishedDate: "2015-06-20",
      description: "자세히 보아야 예쁘다, 오래 보아야 사랑스럽다, 너도 그렇다. 시인의 따스하고 소박한 눈길을 통해 자연의 풀잎과 내 곁의 평범한 이들을 노래한 맑은 시 모음집.",
      categories: ["시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=꽃을+보듯+너를+본다"
    },
    {
      id: "local-58",
      title: "사랑하라 한번도 상처받지 않은 것처럼",
      authors: "류시화 편",
      publisher: "오래된미래",
      publishedDate: "2005-03-15",
      description: "고대 부족의 기도의 노래부터 현대 거장들의 성찰적 잠언시까지 영혼의 위로와 삶의 신비로움을 채워줄 동서고금의 눈부신 치유와 성찰의 명시 선집.",
      categories: ["시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1513001900722-370f803f498d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=사랑하라+한번도+상처받지+않은+것처럼"
    },
    {
      id: "local-59",
      title: "서른, 잔치는 끝났다",
      authors: "최영미",
      publisher: "창비",
      publishedDate: "1994-06-10",
      description: "80년대 혁명의 뜨거운 열정이 식고 서른에 도달한 세대의 공허와 도발적인 자기 성찰을 도도하고 거침없는 시적 언어로 담아내 큰 센세이션을 일으킨 시집.",
      categories: ["시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1508780709619-79562469964d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.4,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=서른+잔치는+끝났다"
    },
    {
      id: "local-60",
      title: "입 속의 검은 잎",
      authors: "기형도",
      publisher: "문학과지성사",
      publishedDate: "1989-05-30",
      description: "요절한 시인 기형도가 쓸쓸하고도 차가운 현대 도시 속 그로테스크한 슬픔과 존재론적 불안을 응축된 독특한 우울의 시어로 노래한 기념비적 시집.",
      categories: ["시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1550399105-c4dbb6779758?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=입속의+검은잎"
    },
    {
      id: "local-61",
      title: "자존감 수업",
      authors: "윤홍균",
      publisher: "심플라이프",
      publishedDate: "2016-09-01",
      description: "자존감이 우리 삶의 관계와 결정에 미치는 결정적 영향을 분석하고, 스스로를 비난하고 학대하던 오랜 마음 습관을 치유할 수 있는 실천적 솔루션을 제공하는 에세이집.",
      categories: ["시/에세이", "자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=자존감+수업"
    },
    {
      id: "local-62",
      title: "태도에 관하여",
      authors: "임경선",
      publisher: "토크쇼",
      publishedDate: "2015-03-23",
      description: "자발성, 성실함, 유연성 등 삶을 관통하는 5가지 중요한 삶의 태도를 바탕으로, 복잡하게 흔들리는 관계 속에서 자신만의 당당하고 우아한 이정표를 지탱하는 법을 말해줍니다.",
      categories: ["시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.5,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=태도에+관하여"
    },
    {
      id: "local-63",
      title: "한 때 소중했던 것들",
      authors: "이기주",
      publisher: "달",
      publishedDate: "2018-09-21",
      description: "흘러가고 잊히는 일상 속 희미한 기억과 사소하고 낡은 물건들로부터 길어 올린 삶의 따뜻한 통찰과 따스함 가득한 회고적 사랑 에세이.",
      categories: ["시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=한때+소중했던+것들"
    },
    {
      id: "local-64",
      title: "무소유",
      authors: "법정",
      publisher: "범우사",
      publishedDate: "1976-04-15",
      description: "소유에서 비롯되는 삶의 모든 집착과 갈등을 비워내고, 작은 난초 화분 하나처럼 자연을 벗 삼아 담백하고 평온한 가치를 추구하는 지혜를 담은 불후의 산문집.",
      categories: ["시/에세이", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.9,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=무소유"
    },
    {
      id: "local-65",
      title: "바깥은 여름",
      authors: "김애란",
      publisher: "문학동네",
      publishedDate: "2017-06-28",
      description: "세상은 눈부신 여름처럼 찬란하게 흐르고 있지만, 그 뒤편에서 가까운 이를 잃고 슬픔과 상실의 겨울에 고독하게 갇힌 현대인들의 마음을 섬세하게 어루만지는 일곱 편의 단편 소설집.",
      categories: ["소설", "시/에세이"],
      thumbnail: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=바깥은+여름"
    },

    // === 자기계발/심리 ===
    {
      id: "local-66",
      title: "프레임",
      authors: "최인철",
      publisher: "21세기북스",
      publishedDate: "2007-06-20",
      description: "마음의 안경을 깨뜨려라. 어떤 관점의 틀로 상황과 상대를 바라보는지에 따라 우리의 성취와 행복의 깊이가 달라짐을 규명한 인지심리학 교양서.",
      categories: ["자기계발/심리", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=프레임+최인철"
    },
    {
      id: "local-67",
      title: "도파민네이션",
      authors: "애나 렘키",
      publisher: "흐름출판",
      publishedDate: "2021-08-25",
      description: "숏폼, 쇼핑, 카페인 등 즉각적 보상이 넘쳐나는 뇌 도파민 중독 과잉 시대에서, 쾌락 뒤에 찾아오는 무기력과 고통의 생물학적 균형을 회복하는 뇌과학적 처방전.",
      categories: ["자기계발/심리", "과학/IT"],
      thumbnail: "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=도파민네이션"
    },
    {
      id: "local-68",
      title: "아주 작은 습관의 힘",
      authors: "제임스 클리어",
      publisher: "비즈니스북스",
      publishedDate: "2018-10-16",
      description: "하루 단 1%의 미세한 성장 습관이 가져오는 복리적 파급 효과를 토대로, 좋은 정체성을 세우고 환경을 설계하여 나쁜 습관을 지렛대로 활용하는 법을 전수합니다.",
      categories: ["자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=아주+작은+습관의+힘"
    },
    {
      id: "local-69",
      title: "그리트 GRIT",
      authors: "앤절라 더크워스",
      publisher: "비즈니스북스",
      publishedDate: "2016-05-03",
      description: "성공을 좌우하는 것은 타고난 재능이 아니라, 끊임없는 관심사의 연마와 끈기 넘치는 열정을 동반한 투지(GRIT)임을 수많은 종단 연구와 임상 사례로 밝혀냅니다.",
      categories: ["자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=그리트"
    },
    {
      id: "local-70",
      title: "역행자",
      authors: "자청",
      publisher: "웅진지식하우스",
      publishedDate: "2022-05-30",
      description: "유전자와 무의식의 꼭두각시에서 벗어나라. 삶의 불합리한 오작동 오류를 자각하고 경제적 자유와 행복을 달성하기 위한 7단계 성장 모델을 제안하는 도발적 실천서.",
      categories: ["자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=역행자"
    },
    {
      id: "local-71",
      title: "데일 카네기 인간관계론",
      authors: "데일 카네기",
      publisher: "씨앗을뿌리는사람",
      publishedDate: "1936-10-01",
      description: "경청과 진심 어린 칭찬, 상대방의 이익 관점에서의 대화 등 시대를 초월하여 사랑받는 비즈니스 소통 기술과 신뢰감 형성 원리를 정리한 인간관계학의 바이블.",
      categories: ["자기계발/심리", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=인간관계론"
    },
    {
      id: "local-72",
      title: "타이탄의 도구들",
      authors: "팀 페리스",
      publisher: "토네이도",
      publishedDate: "2016-12-06",
      description: "세계 최고의 석학, 예술가, 억만장자 등 타이탄들이 매일 실천하는 일상의 작은 명상, 메모, 건강 루틴들을 수집하여 성공의 발판으로 제공하는 자기 혁신 가이드.",
      categories: ["자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=타이탄의+도구들"
    },
    {
      id: "local-73",
      title: "부자 아빠 가난한 아빠",
      authors: "로버트 기요사키",
      publisher: "민음인",
      publishedDate: "1997-04-01",
      description: "자산과 부채의 올바른 차이를 깨닫고 근로소득을 넘어 자산이 일하는 금융 지능과 투자 전략의 필요성을 환기하여 전 세계 수많은 이들의 자본 관점을 혁신한 베스트셀러.",
      categories: ["자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=부자+아빠+가난한+아빠"
    },
    {
      id: "local-74",
      title: "돈의 속성",
      authors: "김승호",
      publisher: "스노우폭스북스",
      publishedDate: "2020-06-15",
      description: "돈은 인격을 가졌다. 자본을 다루는 가치관 정립부터 종잣돈을 만드는 태도, 투자 공부법 등 백만장자 회장의 풍부한 현실적 혜안을 들려주는 부의 정석.",
      categories: ["자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=돈의+속성"
    },
    {
      id: "local-75",
      title: "시크릿",
      authors: "론다 번",
      publisher: "살림biz",
      publishedDate: "2006-11-28",
      description: "간절히 바라면 온 우주가 돕는다. 끌어당김의 법칙을 매개로 긍정적이고 확신에 찬 자기 암시와 시각화 기법이 지닌 심리적 성공 에너지를 역설한 자기계발서.",
      categories: ["자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1474932430478-367dbb6832c1?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.3,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=시크릿"
    },
    {
      id: "local-76",
      title: "생각에 관한 생각",
      authors: "대니얼 카너먼",
      publisher: "김영사",
      publishedDate: "2011-10-25",
      description: "행동경제학의 창시자가 직관적인 빠른 생각(System 1)과 신중한 느린 생각(System 2)이 인간 행동과 경제적 선택 결정을 어떻게 지배하는지 규명한 역작.",
      categories: ["자기계발/심리", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=생각에+관한+생각"
    },
    {
      id: "local-77",
      title: "신경 끄기의 기술",
      authors: "마크 맨슨",
      publisher: "갤리온",
      publishedDate: "2016-09-13",
      description: "무조건적인 긍정은 독이다. 수많은 불필요한 사회적 가치들에 과감히 신경을 끄고, 삶의 고통을 껴안으며 인생에서 가장 핵심적인 가치에 집중할 것을 조언하는 현실 에세이.",
      categories: ["자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.5,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=신경끄기의+기술"
    },
    {
      id: "local-78",
      title: "원씽 The One Thing",
      authors: "게리 켈러, 제이 파파잔",
      publisher: "비즈니스북스",
      publishedDate: "2012-07-10",
      description: "수많은 할 일 리스트의 유혹을 뿌리치고, 당신의 커리어와 삶의 목표를 단번에 혁신할 가장 지배적인 단 하나의 핵심 목표(One Thing)에 에너지를 집중하는 성공 방정식.",
      categories: ["자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1513001900722-370f803f498d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=원씽"
    },

    // === SF/판타지 ===
    {
      id: "local-79",
      title: "우리가 빛의 속도로 갈 수 없다면",
      authors: "김초엽",
      publisher: "허블",
      publishedDate: "2019-06-24",
      description: "기술 문명이 비약적으로 발달하여 은하계를 횡단하지만 정작 소외와 외로움을 겪는 이들의 온기 가득한 사연을 조용하고 섬세하게 포착한 서정적 SF 단편 소설집.",
      categories: ["SF/판타지", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1508780709619-79562469964d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=우리가+빛의+속도로+갈+수+없다면"
    },
    {
      id: "local-80",
      title: "Dune (듄)",
      authors: "프랭크 허버트",
      publisher: "황금가지",
      publishedDate: "1965-06-01",
      description: "모래로 덮인 행성 아라키스의 귀중한 물물 '스파이스'를 둘러싼 귀족 가문들의 우주적 정치 암투와 사막 부족 메시아 '폴 아트레이데스'의 영웅 서사시.",
      categories: ["SF/판타지", "역사"],
      thumbnail: "https://images.unsplash.com/photo-1550399105-c4dbb6779758?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=Dune"
    },
    {
      id: "local-81",
      title: "해리 포터와 마법사의 돌",
      authors: "J.K. 롤링",
      publisher: "문학수첩",
      publishedDate: "1997-06-26",
      description: "자신이 마법사임을 깨달은 소년 해리 포터가 호그와트 마법학교에 입학해 친구 론, 헤르미온느와 함께 마법 세계의 평화를 위협하는 어둠의 세력에 맞서는 판타지 성장 서사.",
      categories: ["SF/판타지", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=해리포터와+마법사의+돌"
    },
    {
      id: "local-82",
      title: "반지의 제왕",
      authors: "J.R.R. 톨킨",
      publisher: "씨앗을뿌리는사람",
      publishedDate: "1954-07-29",
      description: "중간계의 평화를 위해 어둠의 군주 사우론의 절대반지를 운명의 산 불구덩이에 던지려 모험을 떠나는 프로도와 원정대원들의 장엄하고 환상적인 고전 대하 판타지.",
      categories: ["SF/판타지", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.9,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=반지의+제왕"
    },
    {
      id: "local-83",
      title: "삼체",
      authors: "류츠신",
      publisher: "자음과모음",
      publishedDate: "2008-01-01",
      description: "문화대혁명 혼란 속에서 우주로 쏘아 올려진 전파가 외계인 삼체 문명과 연결되면서, 인류 존재의 안보와 종말의 위기를 다룬 거대한 스케일의 하드 SF 대작.",
      categories: ["SF/판타지", "역사", "과학/IT"],
      thumbnail: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=삼체"
    },
    {
      id: "local-84",
      title: "멋진 신세계",
      authors: "올더스 헉슬리",
      publisher: "소담출판사",
      publishedDate: "1932-02-01",
      description: "모든 인간이 인공 배양되고 감정이 약물 '소마'와 기계적 쾌락으로 완벽히 길들여진 런던에서, 자연 출생자 존이 겪는 비극을 통해 통제와 행복의 도덕적 모순을 다룬 디스토피아.",
      categories: ["SF/판타지", "소설", "인문/철학"],
      thumbnail: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=멋진+신세계"
    },
    {
      id: "local-85",
      title: "안드로이드는 전기양의 꿈을 꾸는가",
      authors: "필립 K. 딕",
      publisher: "폴라북스",
      publishedDate: "1968-03-01",
      description: "방사능 재로 황폐해진 지구에서 인간 도피자들을 잡아내는 현상금 사냥꾼 데커드가 진짜 생명과 복제 안드로이드 사이의 구분을 헤매며 인간성의 본질을 성찰하는 SF.",
      categories: ["SF/판타지", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=안드로이드는+전기양의+꿈을+꾸는가"
    },
    {
      id: "local-86",
      title: "은하수를 여행하는 히치하이커를 위한 안내서",
      authors: "더글러스 애덤스",
      publisher: "책세상",
      publishedDate: "1979-10-12",
      description: "지구가 우주 철거팀에 의해 폭파되기 직전 탈출한 평범한 영국인 아서 덴트의 황당무계하고 기상천외한 은하계 생존 기행을 그린 코믹 SF 명작.",
      categories: ["SF/판타지"],
      thumbnail: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.5,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=은하수+여행+히치하이커"
    },
    {
      id: "local-87",
      title: "파운데이션",
      authors: "아이작 아시모프",
      publisher: "우리나비",
      publishedDate: "1951-06-01",
      description: "심리역사학을 통해 은하제국의 붕괴와 3만 년의 암흑기를 예측한 해리 셀던이 인류의 지식 유산을 보존하기 위해 기지에 세운 '파운데이션'의 장대한 대서사시.",
      categories: ["SF/판타지", "역사"],
      thumbnail: "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=파운데이션"
    },
    {
      id: "local-88",
      title: "프로젝트 헤일메리",
      authors: "앤디 위어",
      publisher: "알에이치코리아",
      publishedDate: "2021-05-04",
      description: "태양 에너지를 흡수하는 아스트로파지로부터 지구 파멸을 막기 위해 단독 외우주 임무를 떠난 유일한 생존 과학자 라일랜드가 외계 생명체 동료 로키와 만나 우정을 다지며 벌이는 생존기.",
      categories: ["SF/판타지", "과학/IT"],
      thumbnail: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.9,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=프로젝트+헤일메리"
    },
    {
      id: "local-89",
      title: "마션",
      authors: "앤디 위어",
      publisher: "알에이치코리아",
      publishedDate: "2011-02-11",
      description: "모래 폭풍으로 화성에 덩그러니 홀로 남겨진 우주 비행사 마크 와트니가 감자와 긍정적 유머, 과학적 끈기만으로 척박한 행성에서 꿋꿋하게 생존해 나가는 이색 과학 생존 소설.",
      categories: ["SF/판타지", "과학/IT"],
      thumbnail: "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=마션"
    },
    {
      id: "local-90",
      title: "천 개의 파랑",
      authors: "천선란",
      publisher: "허블",
      publishedDate: "2020-08-19",
      description: "폐기를 코앞에 둔 휴머노이드 기수 콜리와 부상으로 더는 달리지 못하는 경주마 투데이의 교감을 통해 기술 사회 이면의 소외된 동식물과 소수자의 연대를 어루만지는 SF 명작.",
      categories: ["SF/판타지", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=천+개의+파랑"
    },
    {
      id: "local-91",
      title: "지구 끝의 온실",
      authors: "김초엽",
      publisher: "자이언트북스",
      publishedDate: "2021-08-18",
      description: "세계가 멸망 수준의 유독성 미세물질 '더스트'로 휩쓸렸던 아포칼립스 시대에, 외딴 숲속의 신비로운 온실 속에서 생명을 살려낸 여성들의 정성 가득한 기적 이야기.",
      categories: ["SF/판타지", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=지구+끝의+온실"
    },

    // === 추리/미스터리 ===
    {
      id: "local-92",
      title: "용의자 X의 헌신",
      authors: "히가시노 게이고",
      publisher: "현대문학",
      publishedDate: "2005-08-25",
      description: "천재 수학자 이시가미가 사랑하는 이웃 모녀의 우발적 범죄를 감싸 안기 위해 설계한 완벽하고 기괴한 수학적 알리바이와 천재 물리학자 유카와가 벌이는 두뇌 대결.",
      categories: ["추리/미스터리", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=용의자+X의+헌신"
    },
    {
      id: "local-93",
      title: "그리고 아무도 없었다",
      authors: "애가사 크리스티",
      publisher: "해문출판사",
      publishedDate: "1939-11-06",
      description: "외딴 무인도 별장에 초대받은 열 명의 남녀가 인디언 동요의 구절에 맞춰 한 명씩 섬뜩하게 살해되고, 범인이 보이지 않는 밀실에서 죄의식의 공포를 극대화한 추리 소설의 최고봉.",
      categories: ["추리/미스터리"],
      thumbnail: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=그리고+아무도+없었다"
    },
    {
      id: "local-94",
      title: "다 빈치 코드",
      authors: "댄 브라운",
      publisher: "문학수첩",
      publishedDate: "2003-03-18",
      description: "루브르 박물관 관장의 살인 사건을 필두로 레오나르도 다 빈치의 작품 속에 숨겨진 고대 기독교의 중대한 기호와 음모를 기호학자 랭던 교수가 24시간 동안 풀어나가는 서스펜스.",
      categories: ["추리/미스터리", "역사"],
      thumbnail: "https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.5,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=다빈치코드"
    },
    {
      id: "local-95",
      title: "셜록 홈즈 베스트",
      authors: "아서 코난 도일",
      publisher: "황금가지",
      publishedDate: "1887-11-01",
      description: "안개가 자욱한 빅토리아 시대 런던 베이커가 221B번지에서 관찰과 냉철한 연역적 논리만으로 불가사의한 미궁의 범죄들을 해결해 나가는 천재 탐정 홈즈와 왓슨의 고전 추리집.",
      categories: ["추리/미스터리", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1474932430478-367dbb6832c1?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "성장 동기를 일깨우고 행동을 조언하는 실용서",
      infoLink: "https://books.google.co.kr/books?q=셜록홈즈"
    },
    {
      id: "local-96",
      title: "봉제인형 살인사건",
      authors: "다니엘 콜",
      publisher: "북플라자",
      publishedDate: "2017-02-23",
      description: "서로 다른 여섯 명의 신체 부위를 바늘로 꿰매어 마치 봉제인형처럼 천장에 매달아 둔 엽기적인 연쇄살인 사건의 서스펜스와 예측불허 반전을 선사하는 스릴러.",
      categories: ["추리/미스터리"],
      thumbnail: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.4,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=봉제인형+살인사건"
    },
    {
      id: "local-97",
      title: "가면산장 살인사건",
      authors: "히가시노 게이고",
      publisher: "재인",
      publishedDate: "1990-12-01",
      description: "외딴 별장에 모인 8명의 남녀가 은행 강도단에게 인질로 사로잡힌 상황에서, 인질 중 한 명이 은밀하게 살해당하면서 강도와 인질 간의 팽팽한 불신의 심리전을 펼치는 소설.",
      categories: ["추리/미스터리", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=가면산장+살인사건"
    },
    {
      id: "local-98",
      title: "나미야 잡화점의 기적",
      authors: "히가시노 게이고",
      publisher: "현대문학",
      publishedDate: "2012-03-28",
      description: "과거와 현재의 시간이 30년 간격으로 어우러져 고민 편지를 나누는 잡화점을 무대로, 좀도둑 3인방이 보낸 무심코 던진 조언들이 기적처럼 타인의 삶을 어루만져 주는 이야기.",
      categories: ["소설", "추리/미스터리", "자기계발/심리"],
      thumbnail: "https://images.unsplash.com/photo-1513001900722-370f803f498d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.9,
      style: "가볍고 다정하게 위로해주는 이야기",
      infoLink: "https://books.google.co.kr/books?q=나미야+잡화점의+기적"
    },
    {
      id: "local-99",
      title: "미저리",
      authors: "스티븐 킹",
      publisher: "황금가지",
      publishedDate: "1987-06-08",
      description: "유명 소설가 폴 셸던이 눈길 사고를 당한 뒤 극성팬 애니 윌크스에게 구조되지만, 소설 속 자기가 사랑한 결말을 억지로 바꾸게 하려는 광기 가득한 지하실 감금 스릴러.",
      categories: ["추리/미스터리"],
      thumbnail: "https://images.unsplash.com/photo-1508780709619-79562469964d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=미저리"
    },
    {
      id: "local-100",
      title: "7년의 밤",
      authors: "정유정",
      publisher: "은행나무",
      publishedDate: "2011-03-23",
      description: "댐 건설로 생긴 신비로운 세령호 주변에서 벌어진 소녀 살인 사건 and 자식을 잃고 미쳐 날뛰며 7년간 복수를 치밀하게 감행해 온 한 아버지와 살인자의 쫓고 쫓기는 서사.",
      categories: ["추리/미스터리", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1550399105-c4dbb6779758?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=7년의+밤"
    },
    {
      id: "local-101",
      title: "종의 기원",
      authors: "정유정",
      publisher: "은행나무",
      publishedDate: "2016-05-16",
      description: "어느 날 아침 피 비린내 진동하는 침실에서 피살된 어머니 시체를 목격하고 일시 기억 상실에 걸린 주인공 유진이 자신이 가진 기괴하고 잔혹한 심연을 서서히 복원해가는 사이코패스 스릴러.",
      categories: ["추리/미스터리", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.6,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=종의+기원"
    },
    {
      id: "local-102",
      title: "백설공주에게 죽음을",
      authors: "넬레 노이하우스",
      publisher: "북로드",
      publishedDate: "2010-06-01",
      description: "아름다운 독일 시골마을 타우누스에서 10년 전 벌어진 참혹한 여고생 실종 살인 혐의를 뒤집어쓰고 복역한 남자가 귀향하면서 숨겨진 이웃들의 이기심과 거짓들이 벗겨지는 추리극.",
      categories: ["추리/미스터리"],
      thumbnail: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=백설공주에게+죽음을"
    },
    {
      id: "local-103",
      title: "핑거스미스",
      authors: "사라 워터스",
      publisher: "열린책들",
      publishedDate: "2002-02-01",
      description: "빅토리아 시대 런던의 부유한 대저택을 무대로, 상속녀 모드의 재산을 가로채기 위해 하녀로 잠입한 소매치기 고아 수와 그들 사이에 피어나는 운명적인 속임수와 욕망의 스릴러.",
      categories: ["추리/미스터리", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.7,
      style: "시적이고 서정적이며 여운이 긴 문학",
      infoLink: "https://books.google.co.kr/books?q=핑거스미스"
    },
    {
      id: "local-104",
      title: "모방범",
      authors: "미야베 미유키",
      publisher: "문학동네",
      publishedDate: "2001-03-01",
      description: "사회를 상대로 살인 과정을 중계하며 즐기는 기괴한 지능형 연쇄살인범들과, 그로 인해 파괴된 유족 및 사회적 상흔을 쫓는 도쿄 시타마치 사람들의 절절하고 방대한 범죄 심리 서사.",
      categories: ["추리/미스터리", "소설"],
      thumbnail: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=600",
      averageRating: 4.8,
      style: "깊은 통찰력과 사색을 제공하는 학술서",
      infoLink: "https://books.google.co.kr/books?q=모방범"
    }
  ];

  /* -------------------------------------------------------------------------
   * 1. 전역 상태
   * ----------------------------------------------------------------------- */
  var state = {
    activeView: "home",
    lastMainView: "home",
    selectedGenres: new Set(),
    booksCache: {},
    currentDetailBookId: null,
    editingReviewId: null,
    pendingRating: 0,
    currentApiQuery: "",
    currentRawQuery: "",
    currentPage: 1,
    totalItems: 0,
    isLoadingMore: false,
  };

  var REVIEWS_KEY = "laLibrairieReviews_v1";
  var BOOKS_API   = "https://www.googleapis.com/books/v1/volumes";
  var PAGE_SIZE   = 40;

  // Initialize books cache with local books
  LOCAL_BOOKS.forEach(function(b) {
    state.booksCache[b.id] = b;
  });

  /* -------------------------------------------------------------------------
   * 2. 공통 유틸
   * ----------------------------------------------------------------------- */
  function escapeHTML(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function truncate(str, n) {
    if (!str) return "";
    return str.length > n ? str.slice(0, n).trim() + "…" : str;
  }

  function sanitizeDescription(desc) {
    if (!desc) return "";
    return desc
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  function el(id) { return document.getElementById(id); }

  function showLoader(message) {
    var loader = el("global-loader");
    var msgEl  = el("loader-message");
    if (msgEl)  msgEl.textContent = message || "불러오는 중입니다...";
    if (loader) loader.style.display = "flex";
  }

  function hideLoader() {
    var loader = el("global-loader");
    if (loader) loader.style.display = "none";
  }

  function notify(message) {
    var toast = el("app-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "app-toast";
      Object.assign(toast.style, {
        position:"fixed", bottom:"32px", left:"50%",
        transform:"translateX(-50%)",
        backgroundColor:"var(--color-text-primary)", color:"var(--color-white)",
        padding:"14px 28px", borderRadius:"3px", fontSize:"14px",
        zIndex:"2000", boxShadow:"var(--shadow-subtle)",
        opacity:"0", transition:"opacity .3s",
        maxWidth:"90vw", textAlign:"center",
      });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = "1";
    clearTimeout(window.__appToastTimer);
    window.__appToastTimer = setTimeout(function() {
      toast.style.opacity = "0";
    }, 2800);
  }

  /* -------------------------------------------------------------------------
   * 3. 화면 전환
   * ----------------------------------------------------------------------- */
  function showView(viewId) {
    document.querySelectorAll(".view-section").forEach(function(e) {
      e.classList.remove("active");
    });
    var target = el("view-" + viewId);
    if (target) target.classList.add("active");

    document.querySelectorAll(".nav-tab").forEach(function(e) {
      e.classList.remove("active");
    });
    var tab = el("tab-" + viewId);
    if (tab) tab.classList.add("active");

    state.activeView = viewId;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.navigateTo = function(viewId) {
    showView(viewId);
    if (viewId !== "book-detail") state.lastMainView = viewId;
  };

  window.navigateBack = function() {
    showView(state.lastMainView || "home");
  };

  /* -------------------------------------------------------------------------
   * 4. Google Books API 및 로컬 백업 연동
   * ----------------------------------------------------------------------- */
  function normalizeBookItem(item) {
    var info  = item.volumeInfo || {};
    var links = info.imageLinks  || {};
    var thumbnail = links.thumbnail || links.smallThumbnail || null;
    if (thumbnail) thumbnail = thumbnail.replace(/^http:/, "https:");
    return {
      id:            item.id,
      title:         info.title         || "제목 미상",
      authors:       (info.authors && info.authors.length) ? info.authors.join(", ") : "작가 미상",
      publisher:     info.publisher     || "",
      publishedDate: info.publishedDate || "",
      description:   info.description   || "",
      categories:    info.categories    || [],
      thumbnail:     thumbnail,
      averageRating: info.averageRating || null,
      infoLink:      info.infoLink || info.canonicalVolumeLink || null,
    };
  }

  /**
   * 단일 페이지 요청. { items, totalItems } 반환.
   */
  function searchBooksRaw(query, opts) {
    opts = opts || {};
    var params = new URLSearchParams({ q: query });
    params.set("maxResults", String(Math.min(opts.maxResults || PAGE_SIZE, 40)));
    params.set("startIndex", String(opts.startIndex || 0));
    if (opts.langRestrict) params.set("langRestrict", opts.langRestrict);
    if (opts.orderBy)      params.set("orderBy",      opts.orderBy);
    if (GOOGLE_API_KEY)    params.set("key",          GOOGLE_API_KEY);

    return fetch(BOOKS_API + "?" + params.toString())
      .then(function(res) {
        if (!res.ok) {
          return res.text().then(function(body) {
            throw new Error("API " + res.status + ": " + body.slice(0, 100));
          });
        }
        return res.json();
      })
      .then(function(data) {
        return {
          items:      (data.items || []).map(normalizeBookItem),
          totalItems: data.totalItems || 0,
        };
      });
  }

  /** 실패해도 빈 결과를 반환하는 안전한 버전 */
  function searchBooksRawSafe(query, opts) {
    return searchBooksRaw(query, opts).catch(function() {
      return { items: [], totalItems: 0 };
    });
  }

  function fetchBookById(id) {
    if (id && id.indexOf("local-") === 0) {
      var found = LOCAL_BOOKS.find(function(b) { return b.id === id; });
      if (found) return Promise.resolve(found);
    }
    var url = BOOKS_API + "/" + id + (GOOGLE_API_KEY ? "?key=" + GOOGLE_API_KEY : "");
    return fetch(url).then(function(res) {
      if (!res.ok) throw new Error("도서 정보를 찾을 수 없습니다.");
      return res.json();
    }).then(normalizeBookItem);
  }

  /* -------------------------------------------------------------------------
   * 5. 도서 카드 HTML
   * ----------------------------------------------------------------------- */
  function bookCardHTML(book, opts) {
    opts = opts || {};
    var year   = book.publishedDate ? book.publishedDate.slice(0, 4) : "";
    var desc   = truncate(sanitizeDescription(book.description), 90);
    var safeId = escapeHTML(book.id);
    return (
      '<div class="card" style="cursor:pointer;display:flex;flex-direction:column;overflow:hidden;height:100%;" onclick="showBookDetail(\'' + safeId + '\')">' +
        '<div style="width:100%;height:260px;background-color:var(--color-bg-secondary);display:flex;align-items:center;justify-content:center;overflow:hidden;">' +
          (book.thumbnail
            ? '<img src="' + book.thumbnail + '" alt="' + escapeHTML(book.title) + ' 표지" loading="lazy" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML=\'<span style=\\\'font-size:36px;\\\'>📕</span>\'">'
            : '<span style="font-size:36px;">📕</span>') +
        '</div>' +
        '<div style="padding:20px;display:flex;flex-direction:column;gap:8px;flex-grow:1;">' +
          '<h4 style="font-size:16px;font-weight:700;line-height:1.4;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + escapeHTML(book.title) + '</h4>' +
          '<p style="font-size:13px;color:var(--color-text-secondary);margin:0;">' + escapeHTML(book.authors) + (year ? " · " + year : "") + '</p>' +
          '<p style="font-size:13px;color:var(--color-text-tertiary);line-height:1.6;margin:0;flex-grow:1;">' + (escapeHTML(desc) || "도서 소개가 준비중입니다.") + '</p>' +
          (opts.aiReason
            ? '<div style="margin-top:6px;padding:12px 14px;background-color:var(--color-bg-secondary);border-left:3px solid var(--color-gold);font-size:13px;font-style:italic;color:var(--color-text-primary);line-height:1.6;">' + escapeHTML(opts.aiReason) + '</div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  /* -------------------------------------------------------------------------
   * 6. 검색 결과 렌더링 및 로컬 서재 검색 함수
   * ----------------------------------------------------------------------- */
  function searchLocalBooks(query, type) {
    var q = (query || "").toLowerCase().trim();
    if (!q) return [];
    return LOCAL_BOOKS.filter(function(book) {
      if (type === "title") {
        return book.title.toLowerCase().indexOf(q) !== -1;
      } else if (type === "author") {
        return book.authors.toLowerCase().indexOf(q) !== -1;
      } else if (type === "genre") {
        return book.categories.some(function(cat) {
          return cat.toLowerCase().indexOf(q) !== -1;
        });
      } else {
        // all
        return (
          book.title.toLowerCase().indexOf(q) !== -1 ||
          book.authors.toLowerCase().indexOf(q) !== -1 ||
          book.description.toLowerCase().indexOf(q) !== -1 ||
          book.categories.some(function(cat) {
            return cat.toLowerCase().indexOf(q) !== -1;
          })
