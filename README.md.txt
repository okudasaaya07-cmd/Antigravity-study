# 📖 La Librairie — AI 책 추천 서비스

> 당신만을 위한 깊이 있고 우아한 서재

La Librairie는 **클라이언트 사이드 AI 도서 큐레이션 웹 애플리케이션**입니다. 300권 이상의 한국어·영어 명저 데이터베이스를 기반으로 사용자의 취향, 감정, 분위기를 분석하여 맞춤형 도서를 추천합니다.

![La Librairie Preview](https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800)

---

## ✨ 주요 기능

### 🎯 AI 맞춤 책 추천
- 선호 장르, 감정 키워드, 독서 정취를 조합한 정밀 필터링
- 300권 이상의 큐레이팅된 도서 데이터베이스
- 개인 맞춤형 추천사와 함께 5권의 책을 제안

### 🔍 풍부한 도서 검색
- Google Books API 기반 실시간 도서 검색
- 제목, 작가, 장르별 상세 검색 필터
- 한국어·영어 도서 동시 검색 지원
- API 실패 시 로컬 300권 데이터베이스 자동 폴백

### ✍️ 평점 및 리뷰 관리
- 별점(1~5) 및 한 줄 감상평 작성
- 리뷰 수정/삭제 기능
- LocalStorage 기반 영구 저장

---

## 🛠️ 기술 스택

| 기술 | 설명 |
|------|------|
| **HTML5** | 시맨틱 마크업 구조 |
| **CSS3** | Custom Properties 기반 디자인 시스템 |
| **Vanilla JavaScript** | 프레임워크 없이 순수 JS로 구현 |
| **Google Books API** | 실시간 도서 검색 |
| **LocalStorage** | 클라이언트 사이드 데이터 영속화 |
| **Google Fonts** | Song Myung, Nanum Myeongjo, Inter |

---

## 📁 프로젝트 구조

```
book-rec-service/
├── index.html      # 메인 HTML 구조
├── style.css       # 디자인 시스템 및 스타일시트
├── app.js          # 애플리케이션 로직 및 300권 도서 데이터
└── README.md       # 프로젝트 문서
```

---

## 🚀 시작하기

### 로컬 실행
별도의 설치 과정이 필요 없습니다. `index.html` 파일을 브라우저에서 열기만 하면 됩니다.

```bash
# 리포지토리 클론
git clone https://github.com/your-username/book-rec-service.git

# 브라우저에서 열기
open index.html
```

### 또는 Live Server 사용
VS Code의 Live Server 확장 프로그램을 사용하면 더 편리합니다.

---

## 🎨 디자인 철학

- **Ivory / Gray / Gold** 프리미엄 색상 팔레트
- **Song Myung** & **Nanum Myeongjo** 세리프 타이포그래피
- 부드러운 마이크로 애니메이션과 호버 효과
- 글래스모피즘 네비게이션 바
- 반응형 레이아웃 (모바일 지원)

---

## 📚 도서 데이터베이스

300권 이상의 도서가 다음 장르별로 큐레이팅되어 있습니다:

| 장르 | 설명 |
|------|------|
| 소설 | 한국, 영미, 세계 문학 명작 |
| SF/판타지 | 과학소설, 판타지, 디스토피아 |
| 추리/미스터리 | 추리, 스릴러, 범죄 소설 |
| 인문/철학 | 동서양 철학, 인문학 |
| 역사 | 한국사, 세계사, 역사 에세이 |
| 과학/IT | 과학 교양, 프로그래밍, 기술 |
| 시/에세이 | 시집, 산문, 여행 에세이 |
| 자기계발/심리 | 습관, 심리학, 성공학 |

---

## 🔒 개인정보

- **로그인 불필요**: 모든 기능을 즉시 사용 가능
- **서버 미사용**: 모든 데이터는 브라우저 LocalStorage에 저장
- **외부 전송 없음**: 개인 리뷰 및 사용 데이터가 외부로 전송되지 않음

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 공개됩니다.

---

<p align="center">
  <strong>La Librairie</strong> © 2026. All Rights Reserved.<br>
  <em>AI Book Recommendation Client Application</em>
</p>