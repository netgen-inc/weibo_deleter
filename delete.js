var fs = require('fs');
var settings = require(__dirname + '/etc/settings.json');
var url = require('url');
var de = require('devent').createDEvent('sender');
var queue = require('queuer');
var logger = require('./lib/logger').logger(settings.logFile);
var util = require('util');
var event = require('events').EventEmitter;

//发送队列的API
var deleteQ = queue.getQueue('http://'+settings.queue.host+':'+settings.queue.port+'/queue', settings.queue.delete);

var Deleter= require('./lib/deleter').Deleter;

//发送对象保存在该数组中
var deleters = [];

var db = require('./lib/db').db;
db.init(settings);

//所有微博账号
var weiboAccounts = {};
db.loadAccounts(function(err, accounts){
    if(err){
        console.log('!!!load account error!!!');   
        return;
    }
    weiboAccounts = accounts;
    console.log('access token loaded');
    //由于发送依赖账号，所以必须先加载完账号才能开始处理发送请求
    console.log('starting dequeue');
    start();
});

var taskBack = function(task,  status){
    if(status){
        de.emit('task-finished', task);  
    }else{
        de.emit('task-error', task);     
    }
}

var dequeue = function(){
    for(var i = 0; i < deleters.length; i++){
        if(settings.mode == 'debug'){
            console.log('running status--'+ i + '--'+ deleters[i].running);
        }
        
        if(deleters[i].running){
            continue;   
        }
        (function(deleter){
            deleter.running = true;
            deleteQ.dequeue(function(err, task){
                if(err == 'empty' || task == undefined){
                    deleter.running = false;
                    console.log('delete queue is empty');
                    return;
                }
                console.log(['dequeue', task]);
                del(task, deleter, {task:task});
            });
        })(deleters[i]);
    }
}

var start = function(){
    setInterval(function(){
        dequeue();    
    }, settings.queue.interval);  
    
    de.on('queued', function( queue ){
        if(queue == settings.queue.delete){
            console.log( queue + "有内容");
            dequeue();
        }
    }); 
    console.log('deleter start ok'); 
}


var del = function(task, deleter, context){
    db.getSentBlogByUri(task.uri, function(err, results){
        if(err || results.length == 0){
            logger.info("error\tNot found the resource:" + task.uri);
            deleter.running = false;
            return; 
        }
        
        blog = results[0];
        
        //微博账号错误
        if(!weiboAccounts[blog.stock_code] || 
            !weiboAccounts[blog.stock_code].access_token || 
            !weiboAccounts[blog.stock_code].access_token_secret){
            logger.info("error\t" + blog.id + "\t" + blog.stock_code + "\tNOT Found the account\t"); 
            deleter.running = false;
            taskBack(task, true);
            return;
        }
        deleter.delete(blog, weiboAccounts[blog.stock_code], context);
    });
};


/**
 发送结束后的处理，返回true表示发送完成
*/
var complete = function(error, body, blog, task){
    if(!error){
        logger.info("success\t" + blog.id + "\t" + blog.weibo_id + "\t"+ blog.stock_code );
        db.deleteSuccess(blog);
        return true;
    }
    
    var errMsg = error.error;
    logger.info("error\t" + blog.id +"\t"+ blog.weibo_id + "\t" + blog.stock_code + "\t" + errMsg);  
    
    if(task.retry >= settings.queue.retry){
        logger.info("error\t" + blog.id +"\t"+ blog.weibo_id + "\t"+ blog.stock_code + "\tretry count more than "+settings.queue.retry);
        return true;
    }else{
        return false;
    }
}


for(i = 0; i < settings.deletersCount; i++){
    var deleter = new Deleter();
    deleter.init(settings);
    (function(s){
        s.on('delete', function(error, body, blog, context){
            s.running = false;
            taskBack(context.task, complete(error, body, blog, context.task));
            dequeue();
        })    
    })(deleter);
    deleters.push(deleter);
}

fs.writeFileSync(__dirname + '/server.pid', process.pid.toString(), 'ascii');

//收到进程信号重新初始化
process.on('SIGUSR2', function () {
    settings = require('./etc/settings.json');
    db.init(settings);
    for(i = 0; i < senders.length; i++){
        senders[i].init(settings);
    }
});

/**
 * 测试代码
setTimeout(function(){
    var sender = new Sender();
    sender.init(settings);
    var task = {uri:'mysql://abc.com/stock_radar#1'};
    sender.on('send', function(error, body, blog, context){
        console.log(error);
        taskBack(context.task, complete(error, body, blog));
    });
    send(task, sender, {task:task});
}, 1000);
 
*/
 
