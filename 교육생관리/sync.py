# -*- coding: utf-8 -*-
"""
교육생 목록.xlsx  →  교육생구글시트용.xlsx 자동 동기화

[규칙]
1. 원본 '교육생 목록.xlsx'의 헤더 행에서 '이름'·'개강반'·'개강반2'·'개강반3' 컬럼을 찾는다
2. 각 교육생에 대해 '가장 최근(가장 오른쪽 비어있지 않은) 개강반' 값을 사용한다
   예) 개강반=2025.08.06, 개강반2=2026.01.14  →  2026.01.14 사용
       개강반=2025.10.22 만 있는 경우       →  2025.10.22 사용
3. 이름이 비어있는 행은 건너뛴다
4. 결과를 '교육생구글시트용.xlsx'에 저장 (이름·개강반 2컬럼만)
   기존 파일은 자동 백업 (.bak)

[수동 예외 처리]
- 자동 규칙이 맞지 않는 학생이 있으면, 원본 파일에서 그 학생의 개강반2/개강반3을 비우면 된다
- 또는 이 스크립트 실행 후 결과 파일을 수동 수정 (단, 다음 실행 시 덮어쓰여짐)

[사용법]
$ python sync.py

신규 교육생 추가 절차:
1) '교육생 목록.xlsx'에 새 교육생 정보 입력 (이름·설명·개강반·비용·비고 등 모두)
2) 이 스크립트 실행 → '교육생구글시트용.xlsx' 자동 갱신
3) '교육생구글시트용.xlsx' 열어 전체 복사 → Google Sheets에 붙여넣기
4) 약 5분 후 라이브 앱(https://guzong.vercel.app)에 자동 반영
"""
import openpyxl
import os, sys, shutil
from datetime import datetime

# 콘솔 한글 출력
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, '교육생 목록.xlsx')
DST = os.path.join(BASE, '교육생구글시트용.xlsx')


def find_header(ws, max_search_rows=10, max_cols=15):
    """헤더 행 위치와 컬럼 매핑을 찾는다"""
    for r in range(1, max_search_rows + 1):
        row = [ws.cell(row=r, column=c).value for c in range(1, max_cols + 1)]
        if '이름' in row and '개강반' in row:
            cols = {}
            cols['이름'] = row.index('이름') + 1
            # 개강반/개강반2/개강반3 컬럼들 (왼쪽→오른쪽 순)
            gan_cols = [i + 1 for i, v in enumerate(row) if v and str(v).startswith('개강반')]
            cols['개강반들'] = gan_cols
            return r, cols
    return None, None


def main():
    if not os.path.exists(SRC):
        print(f'❌ 원본 파일이 없습니다: {SRC}')
        sys.exit(1)

    print('=' * 60)
    print('교육생 명단 동기화')
    print('=' * 60)
    print(f'원본:  {SRC}')
    print(f'대상:  {DST}')
    print()

    # ── 원본 읽기 ─────────────────────────
    wb_src = openpyxl.load_workbook(SRC, data_only=True)
    ws_src = wb_src.active

    header_row, cols = find_header(ws_src)
    if header_row is None:
        print('❌ 헤더 행(이름·개강반)을 찾지 못했습니다.')
        sys.exit(1)

    name_col = cols['이름']
    gan_cols = cols['개강반들']
    print(f'  헤더 행: {header_row} / 이름 열: {name_col} / 개강반 열들: {gan_cols}')
    print()

    # ── 기존 결과 파일 백업 ────────────────
    if os.path.exists(DST):
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        bak = DST + f'.{ts}.bak'
        shutil.copy2(DST, bak)
        print(f'  📦 기존 파일 백업: {os.path.basename(bak)}')
        print()

    # ── 데이터 추출 ────────────────────────
    students = []
    for r in range(header_row + 1, ws_src.max_row + 1):
        name = ws_src.cell(row=r, column=name_col).value
        if not name or not str(name).strip():
            continue

        # 가장 오른쪽 비어있지 않은 개강반 선택
        selected_gan = None
        for c in reversed(gan_cols):
            val = ws_src.cell(row=r, column=c).value
            if val is not None and str(val).strip():
                selected_gan = str(val).strip()
                break

        if not selected_gan:
            print(f'  ⚠️  {name}: 개강반 정보 없음 - 건너뜀')
            continue

        students.append((str(name).strip(), selected_gan))

    # ── 결과 미리보기 ──────────────────────
    print(f'=== 추출 결과 ({len(students)}명) ===')
    for i, (name, gan) in enumerate(students, 1):
        print(f'  {i:2}. {name:8} | {gan}')
    print()

    # ── 구글시트용 파일 작성 ───────────────
    wb_dst = openpyxl.Workbook()
    ws_dst = wb_dst.active
    ws_dst.title = 'Sheet1'
    ws_dst.cell(row=1, column=1, value='이름')
    ws_dst.cell(row=1, column=2, value='개강반')
    for i, (name, gan) in enumerate(students):
        ws_dst.cell(row=i + 2, column=1, value=name)
        ws_dst.cell(row=i + 2, column=2, value=gan)
    wb_dst.save(DST)

    print('✅ 동기화 완료')
    print()
    print('다음 단계:')
    print(f'  1) {os.path.basename(DST)} 열기')
    print('  2) 전체 셀(A1~B마지막) 선택 → 복사')
    print('  3) Google Sheets 열어 A1부터 붙여넣기')
    print('  4) 약 5분 후 https://guzong.vercel.app 에 반영됨')


if __name__ == '__main__':
    main()
