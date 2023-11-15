import { cloneDeep } from 'lodash';
import { GROUPS_LOCAL_STORAGE_KEY, PROJECTS_LOCAL_STORAGE_KEY } from './constants';

const createState = ({ query, navigation, searchType }) => ({
  urlQuery: cloneDeep(query),
  query,
  groups: [],
  fetchingGroups: false,
  projects: [],
  fetchingProjects: false,
  frequentItems: {
    [GROUPS_LOCAL_STORAGE_KEY]: [],
    [PROJECTS_LOCAL_STORAGE_KEY]: [],
  },
  sidebarDirty: false,
  navigation,
  aggregations: {
    error: false,
    fetching: false,
    data: [],
  },
  searchLabelString: '',
  searchType,
});

export default createState;
