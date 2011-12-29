var settings = require('./etc/settings').settings;
var url = require('url');
var Hook = require('hook.io').Hook;
var queue = require('./lib/queue');
var logger = require('./lib/logger').logger(settings.logFile);

var util = require('util');
var fs = require('fs');

//删除队列的API
var removeQ = queue.getQueue('http://'+settings.queue.host+':'+settings.queue.port+'/queue', settings.queue.remove);

//新浪微博的API
var weibo = require('../sender/lib/sina').weibo;
weibo.init(settings);

//初始化mysql客户端
var mysql = require('mysql');
var myCli = mysql.createClient(settings.mysql);
myCli.query('use ' + settings.mysql.database);
myCli.query('set names utf8');

Date.prototype.getStamp = function(){
    var time = this.getTime();   
    return parseInt(time / 1000);
}

var hook = new Hook( {
    name: 'sender',   // 根据模块进行修改
    'hook-host': settings.hook.host,
    debug: true
});

hook.on('hook::ready', function(){
  hook.on('*::queued', function( queue ){
    if(queue == settings.queue.remove){
        console.log( queue + "有内容");
        dequeue();
    }
  });
});
hook.connect();


setInterval(function(){
    dequeue();    
}, settings.queue.interval);

//控制出队频率
var processCount = 0;
var dequeue = function(){
    if(processCount >= 10){
        return;   
    }
    removeQ.dequeue(function(err, task){
        if(err == 'empty' || task == undefined){
            console.log('delete queue is empty');
            return;
        }
        processCount += 1;
        var rm = new Remover();
        rm.on('end', function(){
           processCount -= 1; 
        });
        rm.remove(task);
    });
}

var Remover = function(){
    var _self = this;
    this.remove = function(task){
        _self.getWeiboByUri(task.uri, function(err, results, fields){
            if(err || results.length == 0){
                logger.info("DELETE\tNot found the resource\t" + task.uri);
                hook.emit('task-finished', task); 
            }else{
                weibo.remove(results[0], function(statusCode, body){
                    //20101,微博不存在
                    if(statusCode == 200 || body.error_code == 20101){
                       hook.emit('task-finished', task);
                       _self.removeSuccess(results[0].id);
                    }else{
                       hook.emit('task-error', task);
                    }
                });
            }  
            _self.emit('end');
        });
    };
    
    this.getWeiboByUri = function(uri, cb){
        var uri = url.parse(uri);
        var id = uri.hash.substring(1);
        var sql = "select * from sent_micro_blog where id = '" + id + "'";
        myCli.query(sql, function(err, results, fields){
            cb.call(null, err, results);
        });
    };
    
    this.removeSuccess = function(id){
        var time = new Date().getStamp();
        var sql = "update sent_micro_blog SET deleted_time = '"+time+"',deleted = 1 WHERE id = '"+id+"'";
        myCli.query(sql);
    };
};

util.inherits(Remover, events.EventEmitter);
fs.writeFileSync(__dirname + '/server.pid', process.pid.toString(), 'ascii');