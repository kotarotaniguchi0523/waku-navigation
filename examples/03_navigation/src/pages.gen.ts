// deno-fmt-ignore-file
// biome-ignore-all format: generated types do not need formatting
// prettier-ignore
import type { PathsForPages, GetConfigResponse, SearchCodecsForPages } from 'waku/router';

// prettier-ignore
import type { getConfig as File_Action_getConfig } from './pages/action';
// prettier-ignore
import type { getConfig as File_Broken_getConfig } from './pages/broken';
// prettier-ignore
import type { getConfig as File_Focus_getConfig } from './pages/focus';
// prettier-ignore
import type { getConfig as File_Gate_getConfig } from './pages/gate';
// prettier-ignore
import type { getConfig as File_Index_getConfig } from './pages/index';
// prettier-ignore
import type { getConfig as File_Leave_getConfig } from './pages/leave';
// prettier-ignore
import type { getConfig as File_LongStatic_getConfig } from './pages/long-static';
// prettier-ignore
import type { getConfig as File_Long_getConfig } from './pages/long';
// prettier-ignore
import type { getConfig as File_New_getConfig } from './pages/new';
// prettier-ignore
import type { getConfig as File_Old_getConfig } from './pages/old';
// prettier-ignore
import type { getConfig as File_Short_getConfig } from './pages/short';

// prettier-ignore
type Page =
| ({ path: '/action' } & GetConfigResponse<typeof File_Action_getConfig>)
| ({ path: '/broken' } & GetConfigResponse<typeof File_Broken_getConfig>)
| ({ path: '/focus' } & GetConfigResponse<typeof File_Focus_getConfig>)
| ({ path: '/gate' } & GetConfigResponse<typeof File_Gate_getConfig>)
| ({ path: '/' } & GetConfigResponse<typeof File_Index_getConfig>)
| ({ path: '/leave' } & GetConfigResponse<typeof File_Leave_getConfig>)
| ({ path: '/long-static' } & GetConfigResponse<typeof File_LongStatic_getConfig>)
| ({ path: '/long' } & GetConfigResponse<typeof File_Long_getConfig>)
| ({ path: '/new' } & GetConfigResponse<typeof File_New_getConfig>)
| ({ path: '/old' } & GetConfigResponse<typeof File_Old_getConfig>)
| ({ path: '/short' } & GetConfigResponse<typeof File_Short_getConfig>);

// prettier-ignore
type Layout =
| { path: '/' };

// prettier-ignore
declare module 'waku/router' {
  interface RouteConfig {
    paths: PathsForPages<Page>;
  }
  interface CreatePagesConfig {
    pages: Page;
    layouts: Layout;
  }
  interface SearchCodecsConfig extends SearchCodecsForPages<Page> {}
}
