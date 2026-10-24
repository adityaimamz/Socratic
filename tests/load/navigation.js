import http from 'k6/http';
import {check,sleep} from 'k6';
import {SharedArray} from 'k6/data';
if(__ENV.CONFIRM_STAGING!=='yes')throw new Error('Set CONFIRM_STAGING=yes only for an isolated staging environment.');
const base=__ENV.BASE_URL;if(!base||!__ENV.USERS_FILE)throw new Error('BASE_URL and USERS_FILE are required.');
const users=new SharedArray('navigation users',()=>JSON.parse(open(__ENV.USERS_FILE)));
const count=Number(__ENV.VUS||5);if(users.length<count)throw new Error('Provide a different authenticated account for each virtual user.');
export const options={vus:count,duration:__ENV.DURATION||'60s',thresholds:{http_req_duration:['p(95)<700'],http_req_failed:['rate<0.01'],checks:['rate>0.99']}};
export default function(){
 const user=users[(__VU-1)%users.length],view=user.role==='admin'?'admin-users':user.role==='teacher'?'questions':'student-dashboard';
 const response=http.get(`${base}/api/views/${view}`,{headers:{Cookie:user.cookie},tags:{operation:`view.${view}`}});
 check(response,{'scoped read succeeds':r=>r.status===200,'private data is not publicly cached':r=>(r.headers['Cache-Control']||'').includes('no-store')});
 sleep(Number(__ENV.THINK_SECONDS||1));
}
