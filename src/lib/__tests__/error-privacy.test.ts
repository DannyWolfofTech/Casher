import {describe,it,expect} from 'vitest';
import {privateErrorEvent} from '../error-privacy';
describe('financial error report privacy',()=>{
  it('retains a useful failure location while removing messages, account data and callback tokens',()=>{
    const report=privateErrorEvent({type:undefined,event_id:'event',user:{email:'private@example.test'},
      request:{url:'https://trycasher.com/auth?code=secret-code'},extra:{statement:'PRIVATE BANK ROW'},
      tags:{operation:'load_transactions',owner:'private'},breadcrumbs:[{message:'PRIVATE BANK ROW'}],
      exception:{values:[{type:'TypeError',value:'PRIVATE BANK ROW',stacktrace:{frames:[
        {filename:'https://trycasher.com/assets/index-123.js?code=secret-code',lineno:42,colno:9,vars:{secret:'PRIVATE BANK ROW'}},
      ]}}]},
    });
    const encoded=JSON.stringify(report);
    expect(encoded).not.toMatch(/PRIVATE|private|secret-code|owner|request|breadcrumbs/);
    expect(report.exception?.values?.[0].stacktrace?.frames?.[0]).toMatchObject({filename:'/assets/index-123.js',lineno:42,colno:9});
    expect(report.tags).toEqual({operation:'load_transactions'});
  });
});
