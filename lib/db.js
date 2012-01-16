var mysql = require('mysql'); 
var url = require('url');

var Db = function(){
    var _self = this;
    var settings;
    var cli;
    _self.init = function(configs){
        settings = configs;
        cli = mysql.createClient(settings.mysql);
        cli.query('USE ' + settings.mysql.database);    
        cli.query('SET NAMES utf8');
    }   
    
    _self.loadAccounts = function(cb){
        var sql = "SELECT * FROM account";
        var expired = [], accounts = {};
        cli.query(sql, function(err, results){
            if(err){
                cb(err, null);
                return;
            }
            
            weiboAccounts = {};
            for(var i = 0; i < results.length;i++){
                var wa = results[i];
                if(!wa.access_token || !wa.access_token_secret){
                    console.log('No access_token:' + wa.stock_code);
                }
                weiboAccounts[results[i].stock_code] = wa;
            }
            cb(null, weiboAccounts);
        });
    }

    _self.getSentBlogByUri = function(uri, cb){
        var uri = url.parse(uri);
        var id = uri.hash.substring(1);
        var sql = "select * from sent_micro_blog where id = '" + id + "'";
        cli.query(sql, function(err, results, fields){
            cb.call(null, err, results);
        });
    };
    
    _self.deleteSuccess = function(blog){
        var time = new Date().getTime();
        time = time.toString().substring(0, 10);
        var sql = "update sent_micro_blog SET deleted_time= '"+time+"', deleted= 1 WHERE id = '"+blog.id+"'";
        cli.query(sql);
    }
    
}

exports.db = new Db();
