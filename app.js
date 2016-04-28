// getting required modules
var express = require('express');
var session = require('express-session');
var MemoryStore = session.MemoryStore;
var compress = require('compression');
var bodyParser = require('body-parser');
var multer  = require('multer');
var upload = multer({dest: 'uploads/'});
var fs = require('fs');
var mongoose = require('mongoose');

// initializing mongodb connection and models
mongoose.connect('mongodb://localhost/CheckIt');
var mongodb = mongoose.connection;
mongodb.on('error', function () { console.log("Error connecting to mongodb"); process.exit(1);});
var User = null, Recipe = null, Favourite = null;
mongodb.once('open', function (callback) { 
  console.log("Successfully connected to mongodb");
  var UserSchema = mongoose.Schema({mail: String, password: String});
  User = mongoose.model('User', UserSchema);
  var RecipeSchema = mongoose.Schema({title: String, content: String, image: {data: Buffer, contentType: String}, views: Number, rates: Number, user: String});
  Recipe = mongoose.model('Recipe', RecipeSchema);
  var FavouriteSchema = mongoose.Schema({user: String, recipe: String});
  Favourite = mongoose.model('Favourite', FavouriteSchema);
});

// creating a new session store
var sessionStore = new MemoryStore();
// creating a new app with express framework
var app = express();
app.set('view engine', 'ejs');
app.enable('trust proxy');
// needed to compress all our responses
app.use(compress());
// needed to parse requests body (for example in post requests)
app.use(bodyParser.urlencoded({ extended: false, limit: '10000kb' }));
app.use(bodyParser.json({ limit: '10000kb' }));
// needed to manage sessions
app.use(session({store: sessionStore, secret: 'keyboard cat', resave: true, saveUninitialized: true, cookie: { path: '/', httpOnly: true, secure: false, maxAge: 365*24*60*60*1000}}));

app
.post('/login', function (req, res) {
  if (req.session.user != undefined) {
    res.redirect('/');
  }
  else if (req.body.mail != undefined && req.body.mail != "" &&
    req.body.password != undefined && req.body.password) {
    var mail = req.body.mail;
    var password = req.body.password;
    var redirect = req.body.redirect != undefined && req.body.redirect != "" ? req.body.redirect : "/";
    User.find({mail: mail, password: password}, function (err, obj) {
        if (err || obj.length == 0) res.redirect(redirect + '?error=true');
        else {
          req.session.user = {
            mail: mail,
            uid: obj[0]._id,
          };
          res.redirect(redirect + '?success=true');
        }
    });
  }
  else {
    res.redirect('/register?error=true');
  }
})

.get('/logout', function (req, res) {
  req.session.destroy();
  res.redirect('/');
})

.get('/register', function (req, res) {
  res.setHeader("Content-Type", "text/html");
  var success = req.query.success;
  var error = req.query.error;
  res.render('register', {
    user: req.session.user,
    success: success,
    error: error,
  });
})

.post('/register', function (req, res) {
  if (req.session.user != undefined) {
    res.redirect('/');
  }
  else if (req.body.mail != undefined && req.body.mail != "" &&
    req.body.password != undefined && req.body.password) {
    var mail = req.body.mail;
    var password = req.body.password;
    User.find({mail: mail}, function (err, obj) {
        if (err || obj.length > 0) res.redirect('/register?error=true');
        else {
          new User({mail: mail, password: password})
          .save(function (err, obj) {
              if (err) res.redirect('/register?error=true');
              else {
                req.session.user = {
                  mail: mail,
                  uid: obj._id,
                };
                res.redirect('/?success=true');
              }
          });
        }
    });
  }
  else {
    res.redirect('/register?error=true');
  }
})

.get('/recipe/:recipe_id', function (req, res) {
  if (req.params.recipe_id != undefined && req.params.recipe_id != "") {
    res.setHeader("Content-Type", "text/html");
    var success = req.query.success;
    var error = req.query.error;
    Recipe.find({_id: req.params.recipe_id}, function (err, obj) {
      if (err || obj.length == 0) res.redirect('/');
      else {
        Recipe.update({_id: obj[0]._id}, {views: obj[0].views + 1}, {multi: false}, function (err, obj) {});
        res.render('recipe', {
          user: req.session.user,
          success: success,
          error: error,
          recipe: obj[0],
        });
      }
    });
  }
  else {
    res.redirect('/');
  }
})

.get('/add-recipe', function (req, res) {
  if (req.session.user != undefined) {
    res.setHeader("Content-Type", "text/html");
    var success = req.query.success;
    var error = req.query.error;
    res.render('add-recipe', {
      user: req.session.user,
      success: success,
      error: error,
    });
  }
  else {
    res.redirect('/');
  }
})

.post('/add-recipe', upload.single('image'), function (req, res) {
  if (req.session.user != undefined &&
      req.body.title != undefined && req.body.title != "" &&
      req.body.content != undefined && req.body.content != "" &&
      req.file != undefined) {
    fs.readFile(req.file.path, function(err, data) {
      if (err) res.redirect('/add-recipe?error=true');
      else {
        new Recipe({title: req.body.title, content: req.body.content, image: {data: data, contentType: req.file.mimetype}, views: 0, rates: 0, user: req.session.user.mail})
        .save(function (err, obj) {
            if (err) res.redirect('/add-recipe?error=true');
            else res.redirect('/add-recipe?success=true');
        });
      }
    });
  }
  else {
    res.redirect('/add-recipe?error=true');
  }
})

.get('/recipe/image/:img_id', function (req, res) {
  if (req.params.img_id != undefined && req.params.img_id != "") {
    Recipe.find({_id: req.params.img_id}, function (err, obj) {
        if (err || obj.length == 0) res.end();
        else {
          res.contentType(obj[0].image.contentType);
          res.send(obj[0].image.data);
        }
    });
  }
  else {
    res.end();
  }
})

.get('/my-top', function (req, res) {
  if (req.session.user != undefined) {
    res.setHeader("Content-Type", "text/html");
    var success = req.query.success;
    var error = req.query.error;
    Favourite.find({user: req.session.user.uid}, function (err, obj) {
      if (!err) {
        var recipes_ids = [];
        for (var i = 0; i < obj.length; i++) recipes_ids.push(obj[i].recipe);
        Recipe.find({_id: {$in: recipes_ids}}, function (err, obj) {
          recipes = [];
          if (!err && obj.length > 0) recipes = obj;
          res.render('my-top', {
            user: req.session.user,
            success: success,
            error: error,
            recipes: recipes,
          });
        });
      }
      else {
        res.redirect('/error=true');
      }
    });
  }
  else {
    res.redirect('/');
  }  
})

.get('/top-rated', function (req, res) {
  res.setHeader("Content-Type", "text/html");
  var success = req.query.success;
  var error = req.query.error;
  Recipe.find({}, function (err, obj) {
    var recipes = [];
    if (!err && obj.length > 0) recipes = obj;
    res.render('top-rated', {
      user: req.session.user,
      success: success,
      error: error,
      recipes: recipes,
    });
  }).sort({rates: -1});
})

.post('/recipe/rate/more', function (req, res) {
  var redirect = req.body.redirect != undefined && req.body.redirect != "" ? req.body.redirect : "/";
  if (req.session.user != undefined && req.body.recipe != undefined && req.body.recipe != "") {
    var success = req.query.success;
    var error = req.query.error;
    Recipe.find({_id: req.body.recipe}, function (err, obj) {
      if (err || obj.length == 0) res.redirect(redirect + '?error=true');
      else {
        Favourite.find({user: req.session.user.uid, recipe: req.body.recipe}, function (err, obj2) {
          if (err || obj2.length > 0) res.redirect(redirect + '?error=true');
          else {
            Recipe.update({_id: req.body.recipe}, {rates: obj[0].rates + 1}, {multi: false}, function (err, obj3) {});
            new Favourite({user: req.session.user.uid, recipe: req.body.recipe})
            .save(function (err, obj4) {});
            res.redirect(redirect + '?success=true');
          }
        });
      }
    });
  }
  else {
    res.redirect(redirect + '?error=true');
  }
})

.post('/recipe/rate/less', function (req, res) {
  var redirect = req.body.redirect != undefined && req.body.redirect != "" ? req.body.redirect : "/";
  if (req.session.user != undefined && req.body.recipe != undefined && req.body.recipe != "") {
    var success = req.query.success;
    var error = req.query.error;
    Recipe.find({_id: req.body.recipe}, function (err, obj) {
      if (err || obj.length == 0) res.redirect(redirect + '?error=true');
      else {
        Favourite.find({user: req.session.user.uid, recipe: req.body.recipe}, function (err, obj2) {
          if (err || obj2.length > 0) res.redirect(redirect + '?error=true');
          else {
            Recipe.update({_id: req.body.recipe}, {rates: obj[0].rates - 1}, {multi: false}, function (err, obj3) {});
            new Favourite({user: req.session.user.uid, recipe: req.body.recipe})
            .save(function (err, obj4) {});
            res.redirect(redirect + '?success=true');
          }
        });
      }
    });
  }
  else {
    res.redirect(redirect + '?error=true');
  }
})

.get('/top-viewed', function (req, res) {
  res.setHeader("Content-Type", "text/html");
  var success = req.query.success;
  var error = req.query.error;
  Recipe.find({}, function (err, obj) {
    var recipes = [];
    if (!err && obj.length > 0) recipes = obj;
    res.render('top-viewed', {
      user: req.session.user,
      success: success,
      error: error,
      recipes: recipes,
    });
  }).sort({views: -1});
})

.get('/search', function (req, res) {
  res.setHeader("Content-Type", "text/html");
  var success = req.query.success;
  var error = req.query.error;
  var search = "";
  if (req.query.query != undefined && req.query.query != "") search = req.query.query;
  Recipe.find({"title": {"$regex": search, "$options": "i"}}, function (err, obj) {
    var recipes = [];
    if (!err && obj.length > 0) recipes = obj;
    res.render('search', {
      user: req.session.user,
      success: success,
      error: error,
      recipes: recipes,
      search: search,
    });
  });
})

.get('/index', function (req, res) {
  res.setHeader("Content-Type", "text/html");
  var success = req.query.success;
  var error = req.query.error;
  res.render('index', {
    user: req.session.user,
    success: success,
    error: error,
  });
})

.get('/', function (req, res) {
  res.setHeader("Content-Type", "text/html");
  var success = req.query.success;
  var error = req.query.error;
  res.render('index', {
    user: req.session.user,
    success: success,
    error: error,
  });
})

// route to get static files
.use(express.static(__dirname + '/app'))

app.listen(1337, 'localhost');
console.log('HTTP Server running at http://localhost:1337/');