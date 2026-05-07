# -*- coding: utf-8 -*-
"""
교육생 목록.xlsx  →  교육생구글시트용.xlsx → Google Sheets 자동 동기화

[규칙]
1. 원본 '교육생 목록.xlsx'의 헤더 행에서 '이름'·'개강반'·'개강반2'·'개강반3' 컬럼을 찾는다
2. 각 교육생에 대해 '가장 최근(가장 오른쪽 비어있지 않은) 개강반' 값을 사용한다
   예) 개강반=2025.08.06, 개강반2=2026.01.14  →  2026.01.14 사용
       개강반=2025.10.22 만 있는 경우       →  2025.10.22 사용
3. 이름이 비어있는 행은 건너뛴다
4. 결과를 '교육생구글시트용.xlsx'에 저장 (이름·개강반 2컬럼만)
5. service-account.json 이 있으면 Google Sheets 에도 자동 push

[사용법]
$ python sync.py
"""
import openpyxl
import os, sys, shutil
from datetime import datetime

SHEET_ID = '1n28IPdaxcc4ty5C7E_DiPTVb5RTAzLQddyMlzYHeJ74'
WORKSHEET_GID = 1230895908

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

    print('✅ 로컬 동기화 완료')
    print()

    # ── Google Sheets 자동 push ─────────────
    key_file = os.path.join(BASE, 'service-account.json')
    if not os.path.exists(key_file):
        print('ℹ️  service-account.json 없음 — Google Sheets push 건너뜀')
        print('    수동: 구글시트용.xlsx 복사 → Sheets 붙여넣기')
        return

    print('Google Sheets 푸시 중...')
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        scopes = ['https://www.googleapis.com/auth/spreadsheets']
        creds = Credentials.from_service_account_file(key_file, scopes=scopes)
        gc = gspread.authorize(creds)
        sh = gc.open_by_key(SHEET_ID)
        ws = sh.get_worksheet_by_id(WORKSHEET_GID)

        values = [['이름', '개강반']] + [[name, gan] for name, gan in students]
        ws.clear()
        ws.update(values=values, range_name='A1')

        print(f'✅ Google Sheets 푸시 완료 ({len(students)}명)')
        print('   ~5분 후 https://guzong.vercel.app 에 반영됨')
    except gspread.exceptions.APIError as e:
        print(f'❌ Google Sheets API 오류: {e}')
        print('   → 시트가 서비스 계정에 편집자 공유 됐는지 확인:')
        print('   seoul-edu-sync@quantum-toolbox-488410-n4.iam.gserviceaccount.com')
    except Exception as e:
        print(f'❌ 푸시 실패: {type(e).__name__}: {e}')


if __name__ == '__main__':
    main()
