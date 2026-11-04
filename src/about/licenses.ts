import { AUTOPEP8_REQUIREMENTS } from '../format/formatModule'

export interface LicenseLink {
  readonly label: string
  readonly url: string
}

export interface LicenseEntry {
  readonly name: string
  readonly version: string
  readonly licenses: readonly LicenseLink[]
  readonly copyright: string
  readonly url: string
  // 複数ライセンスの対象の内訳など、バッジだけでは伝わらない補足
  readonly note?: string
}

const MIT: LicenseLink = { label: 'MIT', url: 'https://opensource.org/license/mit' }
const MPL2: LicenseLink = { label: 'MPL-2.0', url: 'https://www.mozilla.org/MPL/2.0/' }
const APACHE2: LicenseLink = { label: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' }
const BSD3: LicenseLink = { label: 'BSD-3-Clause', url: 'https://opensource.org/license/bsd-3-clause' }
const OFL: LicenseLink = { label: 'SIL OFL 1.1', url: 'https://openfontlicense.org/open-font-license-official-text/' }
const CC_BY: LicenseLink = { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }
const LGPL21: LicenseLink = { label: 'LGPL-2.1', url: 'https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html' }
const PSF: LicenseLink = { label: 'PSF License', url: 'https://docs.python.org/3/license.html' }
const MATPLOTLIB: LicenseLink = { label: 'Matplotlib License', url: 'https://matplotlib.org/stable/project/license.html' }

// 整形ボタンの初回利用時に micropip が取得する版（formatModule.ts の固定値と二重管理にしない）
function pinnedVersion(name: string): string {
  const spec = AUTOPEP8_REQUIREMENTS.find(r => r.startsWith(`${name}==`))
  return spec ? spec.slice(name.length + 2) : ''
}

// 版数は node_modules の package.json と Pyodide 0.27.0 の pyodide-lock.json で確認したもの。
// DOMPurify と marked は npm のパッケージではなく Monaco Editor が内部に持つコピーがバンドルされる
export const LICENSES: readonly LicenseEntry[] = [
  {
    name: 'Monaco Editor',
    version: '0.55',
    licenses: [MIT],
    copyright: 'Copyright (c) 2016 - present Microsoft Corporation',
    url: 'https://github.com/microsoft/monaco-editor',
    note: 'Monaco が内部に含む他のソフトウェアは、同梱の ThirdPartyNotices.txt を参照。',
  },
  {
    name: 'Codicon',
    version: '',
    licenses: [CC_BY, MIT],
    copyright: 'Copyright (c) Microsoft Corporation',
    url: 'https://github.com/microsoft/vscode-codicons',
    note: 'Monaco Editor に同梱のアイコンフォント。アイコンは CC BY 4.0、コードは MIT。',
  },
  {
    name: 'Font Awesome Free',
    version: '7.3',
    licenses: [CC_BY, OFL, MIT],
    copyright: 'Copyright (c) 2026 Fonticons, Inc.',
    url: 'https://fontawesome.com/license/free',
    note: 'アイコンは CC BY 4.0、フォントファイルは SIL OFL 1.1、コードは MIT。',
  },
  {
    name: 'split.js',
    version: '1.6',
    licenses: [MIT],
    copyright: 'Copyright (c) 2020 Nathan Cahill',
    url: 'https://github.com/nathancahill/split',
  },
  {
    name: 'Tailwind CSS',
    version: '4.3',
    licenses: [MIT],
    copyright: 'Copyright (c) Tailwind Labs, Inc.',
    url: 'https://github.com/tailwindlabs/tailwindcss',
  },
  {
    name: 'fflate',
    version: '0.8',
    licenses: [MIT],
    copyright: 'Copyright (c) 2026 Arjun Barrett',
    url: 'https://github.com/101arrowz/fflate',
  },
  {
    name: 'marked',
    version: '14.0',
    licenses: [MIT],
    copyright: 'Copyright (c) 2018+ MarkedJS, 2011-2018 Christopher Jeffrey',
    url: 'https://github.com/markedjs/marked',
    note: 'Monaco Editor が内部に持つコピーを利用。',
  },
  {
    name: 'DOMPurify',
    version: '3.2.7',
    licenses: [MPL2, APACHE2],
    copyright: 'Copyright Dr.-Ing. Mario Heiderich, Cure53 and contributors',
    url: 'https://github.com/cure53/DOMPurify',
    note: 'Monaco Editor が内部に持つコピーを利用。MPL-2.0 と Apache-2.0 のどちらかを選べるデュアルライセンス。',
  },
  {
    name: 'coi-serviceworker',
    version: '0.1.7',
    licenses: [MIT],
    copyright: 'Copyright (c) 2021 Guido Zuidhof',
    url: 'https://github.com/gzuidhof/coi-serviceworker',
  },
  {
    name: 'Pyodide',
    version: '0.27.0',
    // npm の pyodide パッケージの package.json は Apache-2.0 だが、リポジトリの LICENSE は MPL-2.0
    licenses: [MPL2],
    copyright: 'Copyright Pyodide contributors',
    url: 'https://github.com/pyodide/pyodide',
  },
  {
    name: 'Python',
    version: '3.12.7',
    licenses: [PSF],
    copyright: 'Copyright (c) Python Software Foundation',
    url: 'https://www.python.org/',
    note: 'Pyodide 0.27.0 に含まれる CPython。',
  },
  {
    name: 'pygame-ce',
    version: '2.4.1',
    licenses: [LGPL21],
    copyright: 'Copyright pygame community contributors',
    url: 'https://github.com/pygame-community/pygame-ce',
    note: 'Pyodide 0.27.0 同梱の版（SDL2 などを静的リンク）を jsDelivr CDN から読み込んで利用。',
  },
  {
    name: 'micropip',
    version: '0.8.0',
    licenses: [MPL2],
    copyright: 'Copyright Pyodide contributors',
    url: 'https://github.com/pyodide/micropip',
  },
  {
    name: 'jedi',
    version: '0.19.1',
    licenses: [MIT],
    copyright: 'Copyright 2013 David Halter and others',
    url: 'https://github.com/davidhalter/jedi',
  },
  {
    name: 'parso',
    version: '0.8.4',
    licenses: [MIT],
    copyright: 'Copyright 2013 David Halter and others',
    url: 'https://github.com/davidhalter/parso',
  },
  {
    name: 'autopep8',
    version: pinnedVersion('autopep8'),
    licenses: [MIT],
    copyright: 'Copyright (C) 2010-2016 Hideo Hattori, Steven Myint, Bill Wendling',
    url: 'https://github.com/hhatto/autopep8',
    note: '整形ボタンの初回利用時に PyPI から取得（版を固定）。',
  },
  {
    name: 'pycodestyle',
    version: pinnedVersion('pycodestyle'),
    licenses: [MIT],
    copyright: 'Copyright (c) 2006-2020 Johann C. Rocholl, Florent Xicluna, Ian Lee',
    url: 'https://github.com/PyCQA/pycodestyle',
    note: 'autopep8 の依存として PyPI から取得。',
  },
  {
    name: 'NumPy',
    version: '2.0.2',
    licenses: [BSD3],
    copyright: 'Copyright (c) NumPy Developers',
    url: 'https://github.com/numpy/numpy',
    note: 'コードが import したときだけ Pyodide から読み込む。',
  },
  {
    name: 'Matplotlib',
    version: '3.8.4',
    licenses: [MATPLOTLIB],
    copyright: 'Copyright (c) Matplotlib Development Team',
    url: 'https://github.com/matplotlib/matplotlib',
    note: 'コードが import したときだけ Pyodide から読み込む。',
  },
  {
    name: 'Pyodide 配布パッケージ（その他）',
    version: '',
    licenses: [{ label: '各パッケージのライセンス', url: 'https://pyodide.org/en/0.27.0/usage/packages-in-pyodide.html' }],
    copyright: 'Copyright 各パッケージの著作権者',
    url: 'https://pyodide.org/',
    note: 'Matplotlib の依存（Pillow、fonttools、kiwisolver、contourpy、pyparsing、python-dateutil、cycler、pytz、six など）や、コードが import したその他の Pyodide 配布パッケージ。それぞれのライセンスに従う。',
  },
  {
    name: 'BIZ UDPGothic',
    version: '',
    licenses: [OFL],
    copyright: 'Copyright The BIZ UDGothic Project Authors',
    url: 'https://fonts.google.com/specimen/BIZ+UDPGothic',
    note: 'Google Fonts から読み込み。',
  },
  {
    name: '0xProto',
    version: '',
    licenses: [OFL],
    copyright: 'Copyright (c) 2026 0xType Project Authors',
    url: 'https://github.com/0xType/0xProto',
    note: 'Google Fonts から読み込み。',
  },
]
