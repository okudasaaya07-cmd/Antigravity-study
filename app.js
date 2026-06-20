
/* ==========================================================================
   La Librairie — app.js (완전 수정판)
   로컬 100권 데이터로 모든 검색 & AI 추천 동작
   ========================================================================== */
(function () {
  "use strict";
 
  /* ==========================================================
   * 0. 전역 상태
   * ======================================================== */
  var state = {
    activeView: "home",
    lastMainView: "home",
    selectedGenres: new Set(),
    booksCache: {},
    editingReviewId: null,
    pendingRating: 0,
  };
 
  var REVIEWS_KEY = "laLibrairieReviews_v1";
  var OL = "https://covers.openlibrary.org/b/isbn/";
 
  /* ==========================================================
   * 1. 유틸
   * ======================================================== */
  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function clip(s, n) {
    return s && s.length > n ? s.slice(0, n).trim() + "…" : s || "";
  }
  function plain(s) {
    return (s || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .trim();
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  function $id(id) {
    return document.getElementById(id);
  }
 
  function showLoader(msg) {
    var l = $id("global-loader"),
      m = $id("loader-message");
    if (m) m.textContent = msg || "불러오는 중입니다...";
    if (l) l.style.display = "flex";
  }
  function hideLoader() {
    var l = $id("global-loader");
    if (l) l.style.display = "none";
  }
 
  function toast(msg) {
    var t = $id("app-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "app-toast";
      Object.assign(t.style, {
        position: "fixed",
        bottom: "32px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--color-text-primary)",
        color: "var(--color-white)",
        padding: "14px 28px",
        borderRadius: "3px",
        fontSize: "14px",
        zIndex: "2000",
        opacity: "0",
        transition: "opacity .3s",
        maxWidth: "90vw",
        textAlign: "center",
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(window.__tt);
    window.__tt = setTimeout(function () {
      t.style.opacity = "0";
    }, 2800);
  }
 
  /* ==========================================================
   * 2. 화면 전환
   * ======================================================== */
  function showView(id) {
    document.querySelectorAll(".view-section").forEach(function (e) {
      e.classList.remove("active");
    });
    var v = $id("view-" + id);
    if (v) v.classList.add("active");
    document.querySelectorAll(".nav-tab").forEach(function (e) {
      e.classList.remove("active");
    });
    var tab = $id("tab-" + id);
    if (tab) tab.classList.add("active");
    state.activeView = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  window.navigateTo = function (id) {
    showView(id);
    if (id !== "book-detail") state.lastMainView = id;
  };
  window.navigateBack = function () {
    showView(state.lastMainView || "home");
  };
 
  /* ==========================================================
   * 3. 로컬 100권 데이터베이스
   * ======================================================== */
  var PRESET_BOOKS = [
    {id:"p01",title:"채식주의자",authors:"한강",publishedDate:"2007",categories:["소설"],description:"육식을 거부하는 한 여성의 삶을 통해 인간의 욕망, 폭력성, 예술적 열망을 탐구한 맨부커상 수상작. 몸과 마음의 혁명을 그린 현대 문학의 고전.",thumbnail:OL+"9788932025895-M.jpg"},
    {id:"p02",title:"소년이 온다",authors:"한강",publishedDate:"2014",categories:["소설"],description:"1980년 5월 광주를 배경으로 살아남은 자의 죄책감과 죽은 자의 기억을 섬세하게 그린 소설. 국가 폭력과 개인의 트라우마를 조명한 한강의 역작.",thumbnail:OL+"9788936434120-M.jpg"},
    {id:"p03",title:"작별하지 않는다",authors:"한강",publishedDate:"2021",categories:["소설"],description:"제주 4·3 사건을 배경으로 죽은 자와 산 자가 나누는 기억과 상실의 이야기. 역사의 아픔을 아름다운 문체로 담아낸 추도의 소설.",thumbnail:OL+"9788936434625-M.jpg"},
    {id:"p04",title:"흰",authors:"한강",publishedDate:"2016",categories:["에세이"],description:"하얀 것들에 대한 65개의 명상적 단상. 색채와 감정의 본질을 탐구하는 한강의 산문 에세이.",thumbnail:OL+"9788936434182-M.jpg"},
    {id:"p05",title:"82년생 김지영",authors:"조남주",publishedDate:"2016",categories:["소설"],description:"1982년생 평범한 여성의 삶을 통해 한국 사회의 성차별, 불공정, 여성혐오를 날카롭게 조명한 문제작. 대한민국 여성의 초상화.",thumbnail:OL+"9788960402683-M.jpg"},
    {id:"p06",title:"아몬드",authors:"손원평",publishedDate:"2017",categories:["소설"],description:"감정을 느끼지 못하는 소년 윤재의 성장과 진정한 우정의 의미를 그린 감동 소설. 부족한 감정을 채워가는 따뜻한 이야기.",thumbnail:OL+"9788954656795-M.jpg"},
    {id:"p07",title:"달러구트 꿈 백화점",authors:"이미예",publishedDate:"2020",categories:["소설","판타지"],description:"잠든 사람들의 꿈을 판매하는 신비로운 백화점을 배경으로 한 따뜻한 판타지. 감정 치유와 희망의 이야기.",thumbnail:OL+"9791130625454-M.jpg"},
    {id:"p08",title:"불편한 편의점",authors:"김호연",publishedDate:"2022",categories:["소설"],description:"사람들이 모이는 편의점을 배경으로 펼쳐지는 따뜻한 인간관계의 이야기. 일상 속 희망과 위로를 담은 힐링 소설.",thumbnail:OL+"9791165348366-M.jpg"},
    {id:"p09",title:"7년의 밤",authors:"정유정",publishedDate:"2011",categories:["소설","추리"],description:"한 사고가 두 가족을 7년에 걸쳐 어떻게 파멸시키는가를 담은 심리 스릴러. 복수와 진실의 얽힘을 그린 정유정의 대표작.",thumbnail:OL+"9788954608152-M.jpg"},
    {id:"p10",title:"종의 기원",authors:"정유정",publishedDate:"2016",categories:["소설","추리"],description:"인간의 본성과 악의 기원을 심리적으로 탐구하는 스릴러. 인간은 무엇인가 하는 질문을 던지는 철학적 소설.",thumbnail:OL+"9788954630108-M.jpg"},
    {id:"p11",title:"파친코",authors:"이민진",publishedDate:"2017",categories:["소설","역사"],description:"일제강점기부터 현대까지 4대에 걸친 재일조선인 가족의 서사. 아픔과 질김으로 살아가는 이웃 사람들의 뜨거운 이야기.",thumbnail:OL+"9780316346627-M.jpg"},
    {id:"p12",title:"하얼빈",authors:"김훈",publishedDate:"2022",categories:["소설","역사"],description:"안중근 의사의 이토 히로부미 저격 암살까지의 여정을 담은 역사소설. 독립의 염원과 개인의 운명을 그린 장편.",thumbnail:OL+"9788936434601-M.jpg"},
    {id:"p13",title:"완득이",authors:"김려령",publishedDate:"2008",categories:["소설"],description:"가난하고 고단한 환경에서도 당당하게 성장해가는 소년 완득이의 이야기. 희망과 사랑의 의미를 배우는 성장 소설.",thumbnail:OL+"9788993242423-M.jpg"},
    {id:"p14",title:"우리들의 일그러진 영웅",authors:"이문열",publishedDate:"1987",categories:["소설"],description:"초등학교 교실을 배경으로 권력의 속성과 인간관계의 복잡함을 날카롭게 파헤친 이문열의 대표작.",thumbnail:OL+"9788974748098-M.jpg"},
    {id:"p15",title:"한국이 싫어서",authors:"장강명",publishedDate:"2015",categories:["소설"],description:"한국 사회를 떠나 이민을 결심한 젊은 여성의 삶을 통해 현대 한국을 조명하는 소설.",thumbnail:OL+"9788936434434-M.jpg"},
    {id:"p16",title:"죽고 싶지만 떡볶이는 먹고 싶어",authors:"백세희",publishedDate:"2018",categories:["에세이","심리"],description:"기분부전장애를 앓는 저자와 정신과 의사의 따뜻한 대화를 담은 에세이. 마음이 지친 사람을 위한 위로의 글.",thumbnail:OL+"9791188490417-M.jpg"},
    {id:"p17",title:"언어의 온도",authors:"이기주",publishedDate:"2016",categories:["에세이"],description:"언어가 지닌 따뜻함과 냉정함을 섬세하게 탐구한 에세이. 말의 힘과 그 책임을 일깨우는 글모음.",thumbnail:OL+"9791186659205-M.jpg"},
    {id:"p18",title:"나는 나로 살기로 했다",authors:"김수현",publishedDate:"2016",categories:["에세이","자기계발"],description:"지친 현대인에게 자신을 사랑하고 존중하는 법을 전하는 따뜻한 에세이.",thumbnail:OL+"9791159471056-M.jpg"},
    {id:"p19",title:"아버지의 해방일지",authors:"정지아",publishedDate:"2022",categories:["소설","역사"],description:"빨치산 출신 아버지와 그 가족의 삶을 그린 감동적인 역사소설. 개인의 선택과 시대의 운명을 담은 작품.",thumbnail:OL+"9788936434618-M.jpg"},
    {id:"p20",title:"천 개의 파랑",authors:"천선란",publishedDate:"2020",categories:["소설","SF"],description:"다친 기수 대신 경마에 나서는 로봇 기수를 통해 감정과 존재를 탐구하는 SF 소설. 인간다움이란 무엇인지 묻는 작품.",thumbnail:OL+"9791191211467-M.jpg"},
    {id:"p21",title:"노르웨이의 숲",authors:"무라카미 하루키",publishedDate:"1987",categories:["소설"],description:"1960년대 도쿄를 배경으로 상실과 성장, 사랑을 담담하게 그린 하루키의 대표작. 청춘의 아픔과 그리움이 깃든 소설.",thumbnail:OL+"9788937460685-M.jpg"},
    {id:"p22",title:"나미야 잡화점의 기적",authors:"히가시노 게이고",publishedDate:"2012",categories:["소설"],description:"시간을 초월한 편지로 연결되는 사람들의 이야기. 기적과 구원의 의미를 묻는 감동 소설.",thumbnail:OL+"9788933864371-M.jpg"},
    {id:"p23",title:"용의자 X의 헌신",authors:"히가시노 게이고",publishedDate:"2005",categories:["소설","추리"],description:"완벽한 알리바이 뒤에 숨겨진 천재의 헌신을 그린 추리소설. 논리와 감정의 충돌을 다룬 히가시노의 대표작.",thumbnail:OL+"9788937462443-M.jpg"},
    {id:"p24",title:"인간 실격",authors:"다자이 오사무",publishedDate:"1948",categories:["소설"],description:"인간으로서의 자격을 잃어가는 한 남자의 고백체 소설. 현대인의 고독과 부조리를 담은 일본문학 최고의 걸작.",thumbnail:OL+"9788936460358-M.jpg"},
    {id:"p25",title:"설국",authors:"가와바타 야스나리",publishedDate:"1948",categories:["소설"],description:"눈 덮인 온천 마을에서 펼쳐지는 아름답고 쓸쓸한 사랑 이야기. 미학과 고독의 극치를 보여주는 노벨문학상 수상작.",thumbnail:OL+"9788937462344-M.jpg"},
    {id:"p26",title:"세상의 끝과 하드보일드 원더랜드",authors:"무라카미 하루키",publishedDate:"1985",categories:["소설","SF"],description:"두 개의 평행한 세계를 오가는 하루키 특유의 독창적인 장편소설. 현실과 환상의 경계를 넘나드는 작품.",thumbnail:OL+"9788937461118-M.jpg"},
    {id:"p27",title:"1Q84",authors:"무라카미 하루키",publishedDate:"2009",categories:["소설","SF"],description:"1984년과 달이 두 개인 세계 1Q84에서 펼쳐지는 두 남녀의 운명적 이야기. 거대함과 신비로움으로 가득한 하루키의 대작.",thumbnail:OL+"9788937461026-M.jpg"},
    {id:"p28",title:"나는 고양이로소이다",authors:"나쓰메 소세키",publishedDate:"1905",categories:["소설"],description:"고양이의 시선으로 메이지 시대 일본 지식인 사회를 풍자한 소설. 인간 사회의 모순을 웃음과 함께 드러내는 작품.",thumbnail:OL+"9788934980940-M.jpg"},
    {id:"p29",title:"도련님",authors:"나쓰메 소세키",publishedDate:"1906",categories:["소설"],description:"도쿄 출신 청년 교사가 시골 학교에서 겪는 좌충우돌을 그린 소설. 순수함과 세상의 부조리를 그린 소세키의 걸작.",thumbnail:OL+"9788937460562-M.jpg"},
    {id:"p30",title:"악의",authors:"히가시노 게이고",publishedDate:"1996",categories:["소설","추리"],description:"범인을 처음부터 밝히지만 진짜 동기가 무엇인지를 추적하는 역발상 추리소설. 인간의 악의의 본질을 탐구하는 작품.",thumbnail:OL+"9788937462450-M.jpg"},
    {id:"p31",title:"어린 왕자",authors:"앙투안 드 생텍쥐페리",publishedDate:"1943",categories:["소설","판타지"],description:"사막에 불시착한 조종사와 어린 왕자의 만남을 통해 삶의 본질과 사랑을 이야기하는 작품. 세계 최고의 우화.",thumbnail:OL+"9788937460678-M.jpg"},
    {id:"p32",title:"데미안",authors:"헤르만 헤세",publishedDate:"1919",categories:["소설"],description:"자아를 찾아가는 에밀 싱클레어의 성장과 깨달음의 이야기. 영혼의 성장을 그린 헤세의 걸작.",thumbnail:OL+"9788937460555-M.jpg"},
    {id:"p33",title:"수레바퀴 아래서",authors:"헤르만 헤세",publishedDate:"1906",categories:["소설"],description:"시대의 압박 속에서 짓눌리는 한 소년의 비극적 성장을 그린 소설. 교육 제도와 개인의 갈등을 담은 작품.",thumbnail:OL+"9788937460524-M.jpg"},
    {id:"p34",title:"싯다르타",authors:"헤르만 헤세",publishedDate:"1922",categories:["소설","철학"],description:"깨달음을 찾아 떠나는 젊은 브라만 싯다르타의 정신적 여정. 동양 철학을 그린 헤세의 영적 소설.",thumbnail:OL+"9788937460517-M.jpg"},
    {id:"p35",title:"이방인",authors:"알베르 카뮈",publishedDate:"1942",categories:["소설","철학"],description:"태양 때문에 살인을 저지른 뫼르소를 통해 부조리와 인생의 의미를 탐구한 카뮈의 대표작.",thumbnail:OL+"9788937460623-M.jpg"},
    {id:"p36",title:"페스트",authors:"알베르 카뮈",publishedDate:"1947",categories:["소설","철학"],description:"전염병이 창궐한 도시에서 인간의 연대와 고독을 그린 카뮈의 걸작. 현대적 고통과 저항을 담은 소설.",thumbnail:OL+"9788936432003-M.jpg"},
    {id:"p37",title:"오만과 편견",authors:"제인 오스틴",publishedDate:"1813",categories:["소설"],description:"엘리자베스 베넷과 다아시의 사랑을 통해 18세기 영국 사회를 풍자한 소설. 영문학의 최고의 로맨스.",thumbnail:OL+"9788937460296-M.jpg"},
    {id:"p38",title:"위대한 개츠비",authors:"F. 스콧 피츠제럴드",publishedDate:"1925",categories:["소설"],description:"재즈 시대 미국의 화려함과 허무함을 담은 미국 문학의 고전. 미국의 꿈과 그 환멸을 그린 작품.",thumbnail:OL+"9788937460357-M.jpg"},
    {id:"p39",title:"1984",authors:"조지 오웰",publishedDate:"1949",categories:["소설","SF"],description:"전체주의 사회의 공포를 그린 디스토피아 소설의 고전. 권력과 자유에 대한 경고의 목소리.",thumbnail:OL+"9788937460630-M.jpg"},
    {id:"p40",title:"동물농장",authors:"조지 오웰",publishedDate:"1945",categories:["소설"],description:"동물들의 혁명을 통해 권력의 부패와 전체주의를 풍자한 우화. 짧지만 강력한 정치 우화.",thumbnail:OL+"9788937460609-M.jpg"},
    {id:"p41",title:"호밀밭의 파수꾼",authors:"J.D. 샐린저",publishedDate:"1951",categories:["소설"],description:"학교에서 쫓겨난 10대 소년 홀든 콜필드의 방황과 내면을 그린 소설. 청소년의 정체성 탐색을 그린 고전.",thumbnail:OL+"9788937460548-M.jpg"},
    {id:"p42",title:"죄와 벌",authors:"표도르 도스토예프스키",publishedDate:"1866",categories:["소설"],description:"가난한 대학생 라스콜리니코프의 살인과 그 이후의 영혼의 고통을 그린 심리소설. 죄책감과 구원의 변증법.",thumbnail:OL+"9788937462269-M.jpg"},
    {id:"p43",title:"변신",authors:"프란츠 카프카",publishedDate:"1915",categories:["소설"],description:"어느 날 아침 거대한 벌레로 변해버린 그레고르 잠자의 이야기. 인간의 소외와 부조리를 극단적으로 표현한 작품.",thumbnail:OL+"9788937460531-M.jpg"},
    {id:"p44",title:"노인과 바다",authors:"어니스트 헤밍웨이",publishedDate:"1952",categories:["소설"],description:"늙은 어부 산티아고와 거대한 청새치의 사투를 담은 퓰리처상 수상작. 인간의 의지와 운명의 대대(對對).",thumbnail:OL+"9788937460593-M.jpg"},
    {id:"p45",title:"제인 에어",authors:"샬럿 브론테",publishedDate:"1847",categories:["소설"],description:"고아 출신 여성 제인 에어의 자립과 사랑을 그린 고전 로맨스. 여성의 자주성과 진정한 사랑을 담은 작품.",thumbnail:OL+"9788937460272-M.jpg"},
    {id:"p46",title:"폭풍의 언덕",authors:"에밀리 브론테",publishedDate:"1847",categories:["소설"],description:"히스클리프와 캐서린의 파멸적인 사랑을 그린 영국 문학의 걸작. 광기와 열정이 뒤섞인 비극적 로맨스.",thumbnail:OL+"9788937460289-M.jpg"},
    {id:"p47",title:"백년의 고독",authors:"가브리엘 가르시아 마르케스",publishedDate:"1967",categories:["소설"],description:"부엔디아 가문의 7대에 걸친 이야기를 마술적 사실주의로 그린 노벨문학상 수상작. 라틴아메리카 문학의 최고봉.",thumbnail:OL+"9788985175166-M.jpg"},
    {id:"p48",title:"연금술사",authors:"파울로 코엘료",publishedDate:"1988",categories:["소설"],description:"자신의 꿈을 찾아 여행을 떠나는 양치기 소년 산티아고의 이야기. 인생의 목적과 영적 성장을 담은 우화.",thumbnail:OL+"9788934969235-M.jpg"},
    {id:"p49",title:"80일간의 세계일주",authors:"쥘 베른",publishedDate:"1872",categories:["소설"],description:"필리어스 포그가 80일 안에 세계를 일주하는 내기를 떠나는 모험소설. 과학과 모험정신을 담은 고전 SF.",thumbnail:OL+"9788937460326-M.jpg"},
    {id:"p50",title:"몬테크리스토 백작",authors:"알렉상드르 뒤마",publishedDate:"1844",categories:["소설"],description:"억울하게 누명을 쓴 에드몽 당테스의 복수를 그린 대하모험소설. 정의와 복수의 의미를 담은 활극.",thumbnail:OL+"9788937460234-M.jpg"},
    {id:"p51",title:"사피엔스",authors:"유발 노아 하라리",publishedDate:"2011",categories:["역사","인문"],description:"인류의 탄생부터 현재까지를 거시적 관점으로 분석한 세계적 베스트셀러. 인간이란 무엇인가를 묻는 통사.",thumbnail:OL+"9788934972464-M.jpg"},
    {id:"p52",title:"호모 데우스",authors:"유발 노아 하라리",publishedDate:"2015",categories:["역사","인문"],description:"인류의 미래와 신이 되려는 호모 사피엔스의 욕망을 탐구한 책. 인류의 진화와 기술의 미래를 조망.",thumbnail:OL+"9788934982753-M.jpg"},
    {id:"p53",title:"21세기를 위한 21가지 제언",authors:"유발 노아 하라리",publishedDate:"2018",categories:["인문"],description:"오늘날 인류가 직면한 21가지 핵심 문제를 다룬 유발 하라리의 세 번째 작품. 현재를 이해하고 미래를 준비하는 안내서.",thumbnail:OL+"9788934985464-M.jpg"},
    {id:"p54",title:"총균쇠",authors:"재레드 다이아몬드",publishedDate:"1997",categories:["역사","과학"],description:"왜 어떤 문명은 번성하고 어떤 문명은 정복당했는가를 과학적으로 분석한 책. 문명의 불균형을 설명하는 획기적 저작.",thumbnail:OL+"9788936434014-M.jpg"},
    {id:"p55",title:"정의란 무엇인가",authors:"마이클 샌델",publishedDate:"2009",categories:["철학"],description:"공정함과 정의에 대한 근본적인 질문을 던지는 하버드 철학 강의. 도덕의 본질을 찾는 철학적 여정.",thumbnail:OL+"9788925539928-M.jpg"},
    {id:"p56",title:"자유로부터의 도피",authors:"에리히 프롬",publishedDate:"1941",categories:["철학","심리"],description:"현대인이 자유를 두려워하고 권위에 복종하는 심리를 분석한 명저. 파시즘의 심리적 뿌리를 파헤친 작품.",thumbnail:OL+"9788932019611-M.jpg"},
    {id:"p57",title:"사랑의 기술",authors:"에리히 프롬",publishedDate:"1956",categories:["철학","심리"],description:"사랑은 감정이 아니라 실천이자 기술임을 역설하는 프롬의 대표작. 인간관계의 본질을 탐구한 고전.",thumbnail:OL+"9788932019635-M.jpg"},
    {id:"p58",title:"군주론",authors:"니콜로 마키아벨리",publishedDate:"1532",categories:["철학","정치"],description:"권력 유지를 위한 현실적 정치술을 논한 르네상스 시대의 고전. 정치의 본질을 드러낸 논쟁작.",thumbnail:OL+"9788937460173-M.jpg"},
    {id:"p59",title:"소크라테스의 변명",authors:"플라톤",publishedDate:"-399",categories:["철학"],description:"죽음 앞에서도 철학적 신념을 굽히지 않은 소크라테스의 마지막 변론. 진리와 용기의 의미를 담은 작품.",thumbnail:OL+"9788937460128-M.jpg"},
    {id:"p60",title:"니코마코스 윤리학",authors:"아리스토텔레스",publishedDate:"-350",categories:["철학"],description:"행복이란 무엇인가에 대해 탐구하는 아리스토텔레스의 윤리학 강의록. 덕과 행복의 관계를 설명하는 철학 명저.",thumbnail:OL+"9788937460135-M.jpg"},
    {id:"p61",title:"아주 작은 습관의 힘",authors:"제임스 클리어",publishedDate:"2018",categories:["자기계발"],description:"1%의 작은 변화가 어떻게 삶을 바꾸는지를 설명하는 습관 형성 가이드. 성공과 성장의 비결을 담은 실용서.",thumbnail:OL+"9791191891027-M.jpg"},
    {id:"p62",title:"그릿",authors:"앤절라 더크워스",publishedDate:"2016",categories:["자기계발","심리"],description:"재능보다 열정과 끈기가 성공을 만든다는 그릿(GRIT) 이론을 다룬 책. 진정한 성공의 요소를 파헤친 저작.",thumbnail:OL+"9788991769342-M.jpg"},
    {id:"p63",title:"미라클 모닝",authors:"할 엘로드",publishedDate:"2012",categories:["자기계발"],description:"아침 1시간이 인생을 바꾼다는 모닝 루틴의 힘을 담은 자기계발서. 삶의 질을 높이는 실천적 방법.",thumbnail:OL+"9791186659021-M.jpg"},
    {id:"p64",title:"원씽",authors:"게리 켈러",publishedDate:"2013",categories:["자기계발"],description:"지금 당장 해야 할 단 하나의 일에 집중하는 삶의 방법을 담은 책. 우선순위와 집중력의 중요성을 설파.",thumbnail:OL+"9788996817536-M.jpg"},
    {id:"p65",title:"데일 카네기 인간관계론",authors:"데일 카네기",publishedDate:"1936",categories:["자기계발"],description:"사람을 움직이고 좋은 관계를 맺는 법칙을 담은 자기계발의 고전. 인간관계의 기술을 알려주는 필독서.",thumbnail:OL+"9788996281634-M.jpg"},
    {id:"p66",title:"부자 아빠 가난한 아빠",authors:"로버트 기요사키",publishedDate:"1997",categories:["자기계발","경제"],description:"돈에 대한 통념을 깨고 경제적 자유를 얻는 방법을 알려주는 재테크 필독서. 금융 교육의 중요성을 강조.",thumbnail:OL+"9788929701200-M.jpg"},
    {id:"p67",title:"유혹하는 글쓰기",authors:"스티븐 킹",publishedDate:"2000",categories:["자기계발"],description:"스릴러 거장 스티븐 킹이 직접 쓴 글쓰기의 모든 것. 창작의 기술과 정신을 담은 고전 글쓰기 교과서.",thumbnail:OL+"9788987050362-M.jpg"},
    {id:"p68",title:"몰입",authors:"미하이 칙센트미하이",publishedDate:"1990",categories:["심리","자기계발"],description:"완전히 빠져드는 경험 '몰입(Flow)'의 조건과 행복의 심리학. 삶의 의미와 행복을 찾는 방법을 담은 책.",thumbnail:OL+"9788971900482-M.jpg"},
    {id:"p69",title:"생각에 관한 생각",authors:"대니얼 카너먼",publishedDate:"2011",categories:["심리","과학"],description:"인간의 두 가지 사고 시스템과 인지 편향을 탁월하게 분석한 행동경제학 명저. 의사결정의 함정과 오류를 파헤친다.",thumbnail:OL+"9788934970354-M.jpg"},
    {id:"p70",title:"넛지",authors:"리처드 세일러, 캐스 선스타인",publishedDate:"2008",categories:["심리","경제"],description:"부드러운 개입으로 사람들의 선택을 개선하는 넛지 이론. 행동경제학을 일상에 적용하는 방법.",thumbnail:OL+"9788984071964-M.jpg"},
    {id:"p71",title:"코스모스",authors:"칼 세이건",publishedDate:"1980",categories:["과학"],description:"우주의 기원부터 생명의 진화까지 장대한 우주의 역사를 담은 과학 고전. 우주에 대한 경이로움을 전하는 명저.",thumbnail:OL+"9788983711892-M.jpg"},
    {id:"p72",title:"이기적 유전자",authors:"리처드 도킨스",publishedDate:"1976",categories:["과학"],description:"유전자의 관점에서 생명의 진화를 설명하는 진화생물학의 고전. 생명의 본질에 대한 혁신적 이해.",thumbnail:OL+"9788932459189-M.jpg"},
    {id:"p73",title:"짧고 쉽게 쓴 시간의 역사",authors:"스티븐 호킹",publishedDate:"1988",categories:["과학"],description:"블랙홀, 빅뱅, 시간의 화살 등 우주의 본질을 쉽게 설명한 과학서. 복잡한 물리학을 대중화한 걸작.",thumbnail:OL+"9788983717108-M.jpg"},
    {id:"p74",title:"페르마의 마지막 정리",authors:"사이먼 싱",publishedDate:"1997",categories:["과학","수학"],description:"358년간 미해결로 남았던 수학 난제가 풀리기까지의 흥미진진한 이야기. 수학과 인간의 집념을 그린 작품.",thumbnail:OL+"9788983710857-M.jpg"},
    {id:"p75",title:"문명의 붕괴",authors:"재레드 다이아몬드",publishedDate:"2004",categories:["과학","역사"],description:"문명이 왜 붕괴되는가를 생태학적으로 분석한 재레드 다이아몬드의 역작. 과거와 미래를 연결하는 통찰.",thumbnail:OL+"9788937460999-M.jpg"},
    {id:"p76",title:"만들어진 신",authors:"리처드 도킨스",publishedDate:"2006",categories:["과학","철학"],description:"종교의 허구성을 과학적 증거로 논박하는 도킨스의 도전적인 저작. 신앙과 과학의 관계를 문제 삼은 책.",thumbnail:OL+"9788932458687-M.jpg"},
    {id:"p77",title:"파인만의 여섯 가지 물리 이야기",authors:"리처드 파인만",publishedDate:"1994",categories:["과학"],description:"노벨물리학상 수상자 파인만이 일반인을 위해 강의한 물리학 입문서. 자연의 신비를 생생하게 전하는 책.",thumbnail:OL+"9788983711496-M.jpg"},
    {id:"p78",title:"엔드 오브 타임",authors:"브라이언 그린",publishedDate:"2020",categories:["과학"],description:"우주의 시작과 끝, 그리고 생명과 의식의 의미를 탐구하는 현대 물리학서. 우주의 미래를 과학적으로 조망.",thumbnail:OL+"9791160028164-M.jpg"},
    {id:"p79",title:"뇌의 배신",authors:"로버트 버튼",publishedDate:"2008",categories:["과학","심리"],description:"뇌가 우리를 어떻게 속이는지를 신경과학으로 풀어낸 책. 뇌과학과 착각에 대한 흥미로운 탐구.",thumbnail:OL+"9788986361698-M.jpg"},
    {id:"p80",title:"왜 세계의 절반은 굶주리는가",authors:"장 지글러",publishedDate:"1999",categories:["사회","과학"],description:"세계 기아 문제의 구조적 원인을 아버지와 아들의 대화로 풀어낸 책. 불평등한 세계를 이해하는 안내서.",thumbnail:OL+"9788984940963-M.jpg"},
    {id:"p81",title:"군중심리",authors:"귀스타브 르봉",publishedDate:"1895",categories:["심리","사회"],description:"군중의 심리와 행동 원리를 분석한 사회심리학의 고전. 집단 행동의 원인과 결과를 파헤친 저작.",thumbnail:OL+"9788934975403-M.jpg"},
    {id:"p82",title:"설득의 심리학",authors:"로버트 치알디니",publishedDate:"1984",categories:["심리","자기계발"],description:"인간을 설득하는 6가지 원칙을 사례와 함께 설명한 심리학 베스트셀러. 영향력의 원리를 밝혀낸 명저.",thumbnail:OL+"9788959134212-M.jpg"},
    {id:"p83",title:"역사란 무엇인가",authors:"E. H. 카",publishedDate:"1961",categories:["역사","인문"],description:"역사와 역사가의 관계, 역사적 진실이란 무엇인지를 탐구한 역사철학 명저. 역사를 보는 방식을 바꾸는 책.",thumbnail:OL+"9788934975007-M.jpg"},
    {id:"p84",title:"대항해시대",authors:"주경철",publishedDate:"2008",categories:["역사"],description:"15~17세기 포르투갈과 스페인의 탐험이 세계를 어떻게 바꾸었는지를 서술한 역사서. 근대세계의 탄생을 그린 작품.",thumbnail:OL+"9788996093053-M.jpg"},
    {id:"p85",title:"오래된 미래",authors:"헬레나 노르베리-호지",publishedDate:"1991",categories:["사회"],description:"인도 라다크 문명을 통해 현대 문명의 문제점을 성찰하는 책. 무한 성장의 신화를 벗는 안내서.",thumbnail:OL+"9788985989299-M.jpg"},
    {id:"p86",title:"침묵의 봄",authors:"레이철 카슨",publishedDate:"1962",categories:["환경","과학"],description:"살충제 남용이 생태계에 미치는 영향을 경고하며 환경운동을 촉발한 명저. 현대 환경운동의 출발점.",thumbnail:OL+"9788937460999-M.jpg"},
    {id:"p87",title:"작은 것이 아름답다",authors:"E. F. 슈마허",publishedDate:"1973",categories:["경제","사회"],description:"인간 중심의 소규모 경제를 제안한 대안 경제학의 고전. 현대 경제에 대한 근본적인 질문을 던진다.",thumbnail:OL+"9788984940079-M.jpg"},
    {id:"p88",title:"월든",authors:"헨리 데이비드 소로",publishedDate:"1854",categories:["에세이","철학"],description:"숲 속 오두막에서 2년간 자급자족하며 단순한 삶을 실험한 소로의 기록. 진정한 삶과 자유의 의미를 담은 고전.",thumbnail:OL+"9788937460142-M.jpg"},
    {id:"p89",title:"자본론 1",authors:"카를 마르크스",publishedDate:"1867",categories:["경제","철학"],description:"자본주의 경제의 구조와 모순을 분석한 사상사 최대의 문제작. 현대 경제를 이해하는 기본 텍스트.",thumbnail:OL+"9788993537048-M.jpg"},
    {id:"p90",title:"프랑스 대혁명사",authors:"토마스 칼릴",publishedDate:"1837",categories:["역사"],description:"프랑스 혁명의 격동을 생생하게 그린 역사서. 근대의 탄생을 보여주는 웅장한 역사 서사.",thumbnail:OL+"9788937460180-M.jpg"},
    {id:"p91",title:"해리 포터와 마법사의 돌",authors:"J.K. 롤링",publishedDate:"1997",categories:["판타지","소설"],description:"마법사 학교 호그와트에서 펼쳐지는 해리 포터의 첫 번째 모험. 전세계를 사로잡은 판타지의 시작.",thumbnail:OL+"9788983920317-M.jpg"},
    {id:"p92",title:"반지의 제왕",authors:"J.R.R. 톨킨",publishedDate:"1954",categories:["판타지","소설"],description:"절대 반지를 둘러싼 선과 악의 거대한 전쟁을 그린 판타지 문학의 원점. 현대 판타지의 아버지.",thumbnail:OL+"9788937460555-M.jpg"},
    {id:"p93",title:"다빈치 코드",authors:"댄 브라운",publishedDate:"2003",categories:["추리","소설"],description:"레오나르도 다빈치의 작품에 숨겨진 기독교 역사의 비밀을 추적하는 스릴러. 미스터리와 재미가 가득한 페이지터너.",thumbnail:OL+"9788937460616-M.jpg"},
    {id:"p94",title:"파우스트",authors:"요한 볼프강 폰 괴테",publishedDate:"1808",categories:["고전","희곡"],description:"인간의 욕망과 구원을 악마와의 계약으로 탐구한 독일 문학의 최고봉. 영원한 욕망의 주제를 다룬 걸작.",thumbnail:OL+"9788937460197-M.jpg"},
    {id:"p95",title:"돈키호테",authors:"미겔 데 세르반테스",publishedDate:"1605",categories:["고전","소설"],description:"기사소설에 빠진 라만차의 귀족 돈키호테의 우스꽝스럽고도 감동적인 모험. 현대 소설의 원조.",thumbnail:OL+"9788937460227-M.jpg"},
    {id:"p96",title:"신곡",authors:"단테 알리기에리",publishedDate:"1320",categories:["고전","시"],description:"지옥·연옥·천국을 여행하며 인간의 죄와 구원을 노래한 이탈리아 문학의 최고작. 중세의 세계관을 담은 서사시.",thumbnail:OL+"9788937460197-M.jpg"},
    {id:"p97",title:"일리아스",authors:"호메로스",publishedDate:"-750",categories:["고전","시"],description:"트로이 전쟁 마지막 해를 배경으로 아킬레우스의 분노를 노래한 서사시. 서양 문학의 기원.",thumbnail:OL+"9788937460159-M.jpg"},
    {id:"p98",title:"오디세이아",authors:"호메로스",publishedDate:"-750",categories:["고전","시"],description:"트로이 전쟁 후 고향 이타카로 돌아가는 오디세우스의 10년 여정. 모험과 인간의 회복력을 그린 고전.",thumbnail:OL+"9788937460166-M.jpg"},
    {id:"p99",title:"앵무새 죽이기",authors:"하퍼 리",publishedDate:"1960",categories:["소설"],description:"인종차별이 심한 미국 남부를 배경으로 한 소녀의 눈으로 본 정의와 양심의 이야기. 미국 남부를 그린 고전.",thumbnail:OL+"9788937460586-M.jpg"},
    {id:"p100",title:"지구의 끝에서 시간을 달리다",authors:"자넷 윙터슨",publishedDate:"2006",categories:["소설","판타지"],description:"현대와 18세기를 오가며 펼쳐지는 사랑과 실험의 이야기. 시간과 공간을 초월한 관계의 아름다움을 그린 작품.",thumbnail:OL+"9788937460609-M.jpg"},
  ];
 
  /* ==========================================================
   * 4. 도서 카드 렌더링
   * ======================================================== */
  function cardHTML(book, reason) {
    var yr = book.publishedDate ? book.publishedDate.slice(0, 4) : "";
    var ds = clip(plain(book.description), 90);
    var sid = esc(book.id);
    return '<div class="card" style="cursor:pointer;display:flex;flex-direction:column;overflow:hidden;height:100%;" onclick="showBookDetail(\'' + sid + '\')"><div style="width:100%;height:260px;background-color:var(--color-bg-secondary);display:flex;align-items:center;justify-content:center;overflow:hidden;">' + (book.thumbnail ? '<img src="' + book.thumbnail + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML=\'<span style=\\\'font-size:36px;\\\'>📕</span>\'">' : '<span style="font-size:36px;">📕</span>') + '</div><div style="padding:20px;display:flex;flex-direction:column;gap:8px;flex-grow:1;"><h4 style="font-size:16px;font-weight:700;line-height:1.4;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + esc(book.title) + '</h4><p style="font-size:13px;color:var(--color-text-secondary);margin:0;">' + esc(book.authors) + (yr ? " · " + yr : "") + '</p><p style="font-size:13px;color:var(--color-text-tertiary);line-height:1.6;margin:0;flex-grow:1;">' + (esc(ds) || "도서 소개가 준비중입니다.") + '</p>' + (reason ? '<div style="margin-top:6px;padding:12px 14px;background-color:var(--color-bg-secondary);border-left:3px solid var(--color-gold);font-size:13px;font-style:italic;line-height:1.6;">' + esc(reason) + '</div>' : "") + '</div></div>';
  }
 
  /* ==========================================================
   * 5. 로컬 검색 기능
   * ======================================================== */
  function searchLocalBooks(query, searchType) {
    var q = (query || "").trim().toLowerCase();
    if (!q) return [];
    return PRESET_BOOKS.filter(function (book) {
      var titleMatch = (book.title || "").toLowerCase().includes(q);
      var authorsMatch = (book.authors || "").toLowerCase().includes(q);
      var descriptionMatch = (book.description || "").toLowerCase().includes(q);
      var categoriesMatch = (book.categories || []).some(function (cat) {
        return cat.toLowerCase().includes(q);
      });
      if (searchType === "title") return titleMatch;
      if (searchType === "author") return authorsMatch;
      if (searchType === "genre") return categoriesMatch;
      return titleMatch || authorsMatch || categoriesMatch || descriptionMatch;
    });
  }
 
  /* ==========================================================
   * 6. 검색 결과 렌더링
   * ======================================================== */
  function renderResults(books, query) {
    var grid = $id("search-results-grid");
    var summary = $id("search-results-summary");
    var empty = $id("search-empty-state");
    if (!grid) return;
    if (!books.length) {
      grid.innerHTML = "";
      if (summary) summary.style.display = "none";
      if (empty) {
        var ps = empty.querySelectorAll("p");
        if (ps[0]) ps[0].textContent = "해당 도서를 서재에서 찾지 못했습니다.";
        if (ps[1]) ps[1].textContent = "다른 키워드로 검색해 보세요.";
        empty.style.display = "block";
      }
      return;
    }
    if (empty) empty.style.display = "none";
    books.forEach(function (b) { state.booksCache[b.id] = b; });
    grid.innerHTML = books.map(function (b) { return cardHTML(b, null); }).join("");
    if (summary) {
      summary.textContent = "'" + query + "'에 대한 검색 결과 " + books.length + "건";
      summary.style.display = "block";
    }
  }
 
  /* ==========================================================
   * 7. 검색 핸들러
   * ======================================================== */
  window.handleSearch = function (e) {
    e.preventDefault();
    var q = ($id("search-input") || {}).value || "";
    var type = ($id("search-type") || {}).value || "all";
    q = q.trim();
    if (!q) { toast("검색어를 입력해 주세요."); return; }
    showLoader("도서를 검색하고 있어요...");
    setTimeout(function () {
      var results = searchLocalBooks(q, type);
      hideLoader();
      renderResults(results, q);
    }, 300);
  };
  window.handleHomeSearch = function (e) {
    e.preventDefault();
    var q = ($id("home-search-input") || {}).value || "";
    q = q.trim();
    if (!q) { toast("검색어를 입력해 주세요."); return; }
    window.navigateTo("search");
    if ($id("search-input")) $id("search-input").value = q;
    if ($id("search-type")) $id("search-type").value = "all";
    window.handleSearch({ preventDefault: function () {} });
  };
 
  /* ==========================================================
   * 8. AI 맞춤 추천
   * ======================================================== */
  function craftReason(book, style, kw, idx) {
    var t = [
      function () { return '"' + style + '"를 찾는 마음에, 「' + book.title + '」가 차분히 다가와 그 결을 채워줄 책입니다.'; },
      function () { return '「' + book.title + '」은 ' + (kw ? "'" + clip(kw, 24) + "'라는 마음" : "지금 이 순간의 마음") + '에 또 하나의 결을 더해줄 한 권입니다.'; },
      function () { return '한 장씩 넘길 때마다, 「' + book.title + '」은 ' + style + '에 가장 가까운 결을 지닌 책으로 다가올 것입니다.'; },
      function () { return '지금 머무는 생각의 결을 따라가 보면, 「' + book.title + '」만큼 어울리는 책을 찾기 어려울 것입니다.'; },
      function () { return (book.categories && book.categories.length ? book.categories[0] + " 서가에서, " : "") + '「' + book.title + '」은 오늘의 당신에게 조용히 건네는 한 권의 위안입니다.'; },
    ];
    return t[idx % t.length]();
  }
  window.toggleGenreSelection = function (btn, genre) {
    if (state.selectedGenres.has(genre)) {
      state.selectedGenres.delete(genre);
      btn.classList.remove("selected");
      btn.style.backgroundColor = btn.style.color = btn.style.borderColor = btn.style.fontWeight = "";
    } else {
      state.selectedGenres.add(genre);
      btn.classList.add("selected");
      btn.style.backgroundColor = "var(--color-gold)";
      btn.style.color = "var(--color-white)";
      btn.style.borderColor = "var(--color-gold)";
      btn.style.fontWeight = "700";
    }
  };
  window.handleRecommendation = function (e) {
    e.preventDefault();
    var genres = Array.from(state.selectedGenres);
    var kw = ($id("recommend-keywords") || {}).value || "";
    kw = kw.trim();
    var style = ($id("recommend-style") || {}).value || "";
    if (!genres.length && !kw) { toast("선호 장르를 선택하거나 키워드를 입력해 주세요."); return; }
    showLoader("당신의 결을 닮은 책을 고르고 있어요...");
    setTimeout(function () {
      var candidates = PRESET_BOOKS.filter(function (book) {
        var genreMatch = !genres.length || genres.some(function (g) { return (book.categories || []).includes(g); });
        var kwMatch = !kw || (book.title + " " + book.description + " " + (book.authors || "")).toLowerCase().includes(kw.toLowerCase());
        return genreMatch && kwMatch;
      });
      hideLoader();
      if (!candidates.length) { toast("조건에 맞는 도서를 찾지 못했습니다. 다른 키워드로 시도해 보세요."); return; }
      shuffle(candidates);
      var picks = candidates.slice(0, 5);
      picks.forEach(function (b) { state.booksCache[b.id] = b; });
      var grid = $id("recommend-grid");
      if (grid) grid.innerHTML = picks.map(function (b, i) { return cardHTML(b, craftReason(b, style, kw, i)); }).join("");
      var fw = $id("recommend-form-wrapper");
      var rw = $id("recommend-results-wrapper");
      if (fw) fw.style.display = "none";
      if (rw) rw.style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 400);
  };
  window.resetRecommendations = function () {
    var fw = $id("recommend-form-wrapper");
    var rw = $id("recommend-results-wrapper");
    if (rw) rw.style.display = "none";
    if (fw) fw.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
 
  /* ==========================================================
   * 9. 도서 상세보기
   * ======================================================== */
  function renderDetail(book) {
    var card = $id("book-detail-card");
    if (!card) return;
    var cats = book.categories.length ? book.categories.join(", ") : "";
    var yr = book.publishedDate ? book.publishedDate.slice(0, 4) : "";
    card.innerHTML = '<div style="background-color:var(--color-bg-secondary);border:1px solid var(--color-border);display:flex;align-items:center;justify-content:center;min-height:380px;overflow:hidden;">' + (book.thumbnail ? '<img src="' + book.thumbnail + '" style="width:100%;height:100%;object-fit:cover;">' : '<span style="font-size:64px;">📕</span>') + '</div><div>' + (cats ? '<p style="font-size:12px;letter-spacing:.1em;color:var(--color-gold-dark);text-transform:uppercase;font-weight:700;margin-bottom:10px;">' + esc(cats) + '</p>' : '') + '<h1 style="font-size:30px;font-weight:800;line-height:1.3;margin-bottom:10px;">' + esc(book.title) + '</h1><p style="font-size:16px;color:var(--color-text-secondary);margin-bottom:18px;">' + esc(book.authors) + (book.publisher ? " · " + esc(book.publisher) : "") + (yr ? " · " + yr : "") + '</p><div class="gold-decor left" style="width:40px;margin:0 0 18px;"></div><p style="font-size:15px;line-height:1.9;color:var(--color-text-primary);white-space:pre-line;">' + (book.description ? esc(plain(book.description)) : "등록된 책 소개가 없습니다.") + '</p></div>';
  }
  window.showBookDetail = function (id) {
    showView("book-detail");
    var book = state.booksCache[id];
    if (book) { renderDetail(book); renderReviews(id); window.scrollTo({ top: 0, behavior: "smooth" }); } else { var c = $id("book-detail-card"); if (c) c.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--color-text-secondary);">도서 정보를 찾을 수 없습니다.</p>'; }
  };
 
  /* ==========================================================
   * 10. 리뷰
   * ======================================================== */
  function allReviews() { try { return JSON.parse(localStorage.getItem(REVIEWS_KEY)) || {}; } catch (_) { return {}; } }
  function saveAll(data) { localStorage.setItem(REVIEWS_KEY, JSON.stringify(data)); }
  function getR(id) { return allReviews()[id] || []; }
  function setR(id, arr) { var a = allReviews(); a[id] = arr; saveAll(a); }
  function starsHTML(avg) { var r = Math.round(avg), h = ""; for (var i = 1; i <= 5; i++) h += '<span style="color:' + (i <= r ? "var(--color-gold)" : "var(--color-border)") + ';font-size:18px;">★</span>'; return h; }
  function pickerHTML(n) { var h = ""; for (var i = 1; i <= 5; i++) h += '<span onclick="setPendingRating(' + i + ')" style="cursor:pointer;font-size:26px;line-height:1;margin-right:4px;color:' + (i <= n ? "var(--color-gold)" : "var(--color-border)") + ';">★</span>'; return h; }
  window.setPendingRating = function (n) { state.pendingRating = n; var e = $id("review-star-picker"); if (e) e.innerHTML = pickerHTML(n); };
  function frmHTML(bookId) { var ed = state.editingReviewId, pre = ""; if (ed) { var f = getR(bookId).find(function (r) { return r.id === ed; }); if (f) { pre = f.comment; state.pendingRating = f.rating; } else { state.editingReviewId = null; state.pendingRating = 0; } } else { state.pendingRating = 0; } return '<div class="card" style="padding:28px;background-color:var(--color-bg-secondary);border:1px solid var(--color-border);"><h4 style="font-size:16px;font-weight:700;margin-bottom:16px;">' + (ed ? "리뷰 수정하기" : "리뷰 작성하기") + '</h4><div id="review-star-picker" style="margin-bottom:14px;">' + pickerHTML(state.pendingRating) + '</div><textarea id="review-comment-input" class="form-control" rows="3" placeholder="이 책에 대한 감상을 남겨주세요." style="resize:none;margin-bottom:14px;background-color:var(--color-white);line-height:1.7;">' + esc(pre) + '</textarea><div style="display:flex;gap:10px;"><button type="button" class="btn btn-primary" style="padding:10px 24px;" onclick="submitReview(\'' + esc(bookId) + '\')">' + (ed ? "수정 완료" : "리뷰 등록") + '</button>' + (ed ? '<button type="button" class="btn btn-secondary" style="padding:10px 24px;" onclick="cancelEditReview(\'' + esc(bookId) + '\'")>취소</button>' : "") + '</div></div>'; }
  function rvHTML(r, bookId) { var d = new Date(r.updatedAt || r.createdAt).toLocaleDateString("ko-KR"); return '<div class="card" style="padding:24px;display:flex;flex-direction:column;gap:10px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;"><div style="color:var(--color-gold);font-size:15px;letter-spacing:1px;">' + "★".repeat(r.rating) + "☆".repeat(5 - r.rating) + '</div><span style="font-size:12px;color:var(--color-text-tertiary);white-space:nowrap;">' + d + (r.updatedAt ? " (수정됨)" : "") + '</span></div><p style="font-size:14px;line-height:1.8;color:var(--color-text-primary);white-space:pre-line;margin:0;">' + esc(r.comment) + '</p><div style="display:flex;gap:8px;margin-top:6px;"><button class="btn btn-secondary" style="padding:6px 14px;font-size:12px;" onclick="startEditReview(\'' + esc(bookId) + "','" + esc(r.id) + '\')">수정</button><button class="btn btn-secondary" style="padding:6px 14px;font-size:12px;" onclick="deleteReview(\'' + esc(bookId) + "','" + esc(r.id) + '\')">삭제</button></div></div>'; }
  function renderReviews(bookId) { var rvs = getR(bookId).slice().sort(function (a, b) { return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt); }); var avg = rvs.length ? rvs.reduce(function (s, r) { return s + r.rating; }, 0) / rvs.length : 0; if ($id("detail-avg-rating")) $id("detail-avg-rating").textContent = avg.toFixed(1); if ($id("detail-avg-stars")) $id("detail-avg-stars").innerHTML = starsHTML(avg); if ($id("detail-review-count")) $id("detail-review-count").textContent = "전체 리뷰 " + rvs.length + "개"; if ($id("write-review-block")) $id("write-review-block").innerHTML = frmHTML(bookId); var list = $id("reviews-list-container"); if (list) list.innerHTML = rvs.length ? rvs.map(function (r) { return rvHTML(r, bookId); }).join("") : '<p style="text-align:center;padding:40px 0;color:var(--color-text-tertiary);background-color:var(--color-white);border:1px solid var(--color-border);">가장 먼저 이 책에 대한 감상을 남겨보세요.</p>'; }
  window.submitReview = function (bookId) { var rating = state.pendingRating, el = $id("review-comment-input"), comment = el ? el.value.trim() : ""; if (!rating) { toast("별점을 선택해 주세요."); return; } if (!comment) { toast("감상평을 입력해 주세요."); return; } var rvs = getR(bookId); if (state.editingReviewId) { rvs = rvs.map(function (r) { return r.id === state.editingReviewId ? Object.assign({}, r, { rating: rating, comment: comment, updatedAt: Date.now() }) : r; }); state.editingReviewId = null; } else { rvs.push({ id: "rv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), rating: rating, comment: comment, createdAt: Date.now() }); } setR(bookId, rvs); state.pendingRating = 0; renderReviews(bookId); toast("리뷰가 저장되었습니다."); };
  window.startEditReview = function (bookId, rvId) { state.editingReviewId = rvId; renderReviews(bookId); var b = $id("write-review-block"); if (b) b.scrollIntoView({ behavior: "smooth", block: "center" }); };
  window.cancelEditReview = function (bookId) { state.editingReviewId = null; state.pendingRating = 0; renderReviews(bookId); };
  window.deleteReview = function (bookId, rvId) { if (!confirm("이 리뷰를 삭제하시겠습니까?")) return; var rvs = getR(bookId).filter(function (r) { return r.id !== rvId; }); setR(bookId, rvs); if (state.editingReviewId === rvId) state.editingReviewId = null; renderReviews(bookId); toast("리뷰가 삭제되었습니다."); };
 
  /* ==========================================================
   * 11. 초기화
   * ======================================================== */
  document.addEventListener("DOMContentLoaded", function () {
    PRESET_BOOKS.forEach(function (b) { state.booksCache[b.id] = b; });
    var grid = $id("search-results-grid");
    if (grid) {
      grid.innerHTML = PRESET_BOOKS.map(function (b) { return cardHTML(b, null); }).join("");
      var summary = $id("search-results-summary");
      if (summary) { summary.textContent = "라 리브레리 추천 도서 " + PRESET_BOOKS.length + "권"; summary.style.display = "block"; }
    }
    window.navigateTo("home");
  });
})();
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
      title: "그ريس인 조르바",
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
      description: "기아와 전염병, 전쟁을 통제하게 된 사피엔스가 이제 영생과 행복, 신성이라는 신적인 영역을 갈망하며 '호모 데우스'로 도약할 것인가, 혹은 데이터 전능주의 아래 종말을 고할 것인가 질문합니다.",
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
      description: "댐 건설로 생긴 신비로운 세령호 주변에서 벌어진 소녀 살인 사건 그리고 자식을 잃고 미쳐 날뛰며 7년간 복수를 치밀하게 감행해 온 한 아버지와 살인자의 쫓고 쫓기는 서사.",
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
        );
      }
    });
  }

  function updateSummary() { 


