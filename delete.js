var settings = require('./etc/settings').settings;
var url = require('url');
var queue = require('queuer');
var de = require('devent').createDEvent('sender');
var logger = require('./lib/logger').logger(settings.logFile);
var event = require('events').EventEmitter;

var util = require('util');
var fs = require('fs');

//删除队列的API
var removeQ = queue.getQueue('http://'+settings.queue.host+':'+settings.queue.port+'/queue', settings.queue.remove);

//新浪微博的API
var weibo = require('./lib/sina').weibo;
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

de.on('queued', function( queue ){
    if(queue == settings.queue.remove){
        console.log( queue + "有内容");
        dequeue();
    }
});


setInterval(function(){
    dequeue();    
}, settings.queue.interval);

//控制出队频率
var removers = [];
var dequeue = function(){
    if(removers.length == 0){
        console.log('remover is busy');
        return;   
    }
    removeQ.dequeue(function(err, task){
        if(err == 'empty' || task == undefined){
            console.log('delete queue is empty');
            return;
        }
        var rm = removers.pop();
        rm.on('end', function(){
            removers.push(rm);
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
                de.emit('task-finished', task); 
            }else{
                weibo.remove(results[0], function(statusCode, body){
                    //20101,微博不存在
                    if(statusCode == 200 || body.error_code == 20101){
                       de.emit('task-finished', task);
                       _self.removeSuccess(results[0].id);
                    }else{
                       de.emit('task-error', task);
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
util.inherits(Remover, event); 

for(i = 0; i < 2; i++){
    var remover = new Remover();
    removers.push(remover);
}
fs.writeFileSync(__dirname + '/server.pid', process.pid.toString(), 'ascii');
