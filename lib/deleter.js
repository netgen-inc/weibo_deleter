var util = require('util');
var event = require('events').EventEmitter;
var weibo = require('weibo');
var Deleter = function(){
    var _self = this;
    _self.running = false;
    var settings, logger, db;
    
    _self.init = function(configs){
        settings = configs;
        weibo.init('tsina', settings.weibo.appkey, settings.weibo.secret);
    }
    
    _self.delete= function(blog, account, context){
        //防止发送超时，进程一直处理等待状态
        var to = setTimeout(function(){
            var error = {statusCode:0, error:'request timeout'};
            _self.emit('delete', error, null, context);
        }, settings.weibo.timeout);
        
        account.blogtype = 'tsina';
        account.authtype = 'oauth';
        account.oauth_token_key = account.access_token;
        account.oauth_token_secret = account.access_token_secret;
        var data = {user:account,id:blog.weibo_id};
        weibo.tapi.destroy(data, function(err, body, response){
            clearTimeout(to);
            if(typeof body == 'string'){
                body = JSON.parse(body);   
            }
            
            _self.running = false;
            
            var error = null;
            if(err){
                error = err.message;
                console.log(error);
            }
           
            _self.emit('delete', error, body, blog, context);
        });
    };
}
util.inherits(Deleter, event);
exports.Deleter= Deleter;
