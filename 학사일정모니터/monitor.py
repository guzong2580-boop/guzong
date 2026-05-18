# -*- coding: utf-8 -*-
"""
서울원격평생교육원 학사일정 변경 감지 스크립트

매일 학사일정 페이지를 크롤링하고, 이전 내용과 비교하여
변경사항이 있으면 GitHub Issue를 생성한다.

[사용법]
$ python monitor.py

[환경변수]
- GITHUB_TOKEN: GitHub Actions에서 자동 제공
- GITHUB_REPOSITORY: GitHub Actions에서 자동 제공
"""
import os
import sys
import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime

SCHEDULE_URL = "https://www.22s.kr/customer/schedule/list.asp"
NOTICE_URL = "https://www.22s.kr/customer/notice/list.asp"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(BASE_DIR, "last_schedule.txt")


def fetch_schedule():
    """학사일정 페이지에서 일정 텍스트 추출"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    resp = requests.get(SCHEDULE_URL, headers=headers, timeout=30)
    resp.encoding = "utf-8"
    soup = BeautifulSoup(resp.text, "html.parser")

    # 페이지 텍스트에서 일정 관련 내용 추출
    text = soup.get_text(separator="\n", strip=True)

    # 핵심 정보만 정리
    lines = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        # 날짜, 기간, 개강, 모집, 수강, 고사 등 키워드 포함 라인
        keywords = ["모집", "수강", "개강", "고사", "시험", "학습", "기간",
                     "신청", "등록", "마감", "종료", "시작", "일정"]
        if any(k in line for k in keywords) or any(c.isdigit() for c in line):
            lines.append(line)

    return "\n".join(lines)


def fetch_latest_notices(count=5):
    """공지사항 최신 글 제목 추출"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    resp = requests.get(NOTICE_URL, headers=headers, timeout=30)
    resp.encoding = "utf-8"
    soup = BeautifulSoup(resp.text, "html.parser")

    notices = []
    # 테이블 행에서 공지 추출
    for a in soup.select("a[href*='view.asp']"):
        title = a.get_text(strip=True)
        if title and len(title) > 3:
            notices.append(title)
        if len(notices) >= count:
            break

    return notices


def load_cache():
    """이전 크롤링 결과 로드"""
    if not os.path.exists(CACHE_FILE) or os.path.getsize(CACHE_FILE) == 0:
        return ""
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        return f.read()


def save_cache(content):
    """크롤링 결과 저장"""
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        f.write(content)


def create_github_issue(title, body):
    """GitHub Issue 생성"""
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")

    if not token or not repo:
        print(f"[로컬 실행] Issue 미생성 - 변경 내용:")
        print(f"  제목: {title}")
        print(f"  내용:\n{body}")
        return

    url = f"https://api.github.com/repos/{repo}/issues"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }
    data = {
        "title": title,
        "body": body,
        "labels": ["학사일정"],
    }
    resp = requests.post(url, headers=headers, json=data, timeout=30)
    if resp.status_code == 201:
        print(f"Issue 생성 완료: {resp.json()['html_url']}")
    else:
        print(f"Issue 생성 실패: {resp.status_code} {resp.text}")


def main():
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"=== 학사일정 변경 감지 ({now}) ===")
    print()

    # 1. 학사일정 크롤링
    print("학사일정 페이지 크롤링...")
    current = fetch_schedule()
    print(f"  추출 라인: {len(current.splitlines())}개")

    # 2. 이전 내용과 비교
    cached = load_cache()

    if current == cached:
        print("  변경 없음. 종료.")
        return

    if not cached:
        print("  최초 실행 - 캐시 저장.")
        save_cache(current)
        return

    # 3. 변경 감지!
    print("  *** 변경 감지! ***")
    print()

    # 변경 내용 비교
    old_lines = set(cached.splitlines())
    new_lines = set(current.splitlines())
    added = new_lines - old_lines
    removed = old_lines - new_lines

    body = f"## 서울원격평생교육원 학사일정 변경 감지\n\n"
    body += f"**감지 시각**: {now}\n"
    body += f"**페이지**: {SCHEDULE_URL}\n\n"

    if added:
        body += "### 추가된 내용\n"
        for line in sorted(added):
            body += f"- {line}\n"
        body += "\n"

    if removed:
        body += "### 삭제된 내용\n"
        for line in sorted(removed):
            body += f"- ~~{line}~~\n"
        body += "\n"

    body += "### 현재 전체 내용\n```\n"
    body += current
    body += "\n```\n"

    title = f"[학사일정 변경] {now}"
    create_github_issue(title, body)

    # 4. 캐시 업데이트
    save_cache(current)
    print("  캐시 업데이트 완료.")


if __name__ == "__main__":
    main()
