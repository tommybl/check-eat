// getting required modules
var express = require('express');
var session = require('express-session');
var MemoryStore = session.MemoryStore;
var compress = require('compression');
var bodyParser = require('body-parser');
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
  var RecipeSchema = mongoose.Schema({title: String, content: String, image: String, views: Number, rates: Number});
  Recipe = mongoose.model('Recipe', RecipeSchema);
  var FavouriteSchema = mongoose.Schema({user: String, recipe: String});
  Favourite = mongoose.model('Favourite', FavouriteSchema);
});

// creating a new session store
var sessionStore = new MemoryStore();
// creating a new app with express framework
var app = express();
app.set('view engine', 'ejs');
// needed to compress all our responses
app.use(compress());
// needed to parse requests body (for example in post requests)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// needed to manage sessions
app.use(session({store: sessionStore, secret: 'keyboard cat', resave: true, saveUninitialized: true, cookie: { path: '/', httpOnly: true, secure: false, maxAge: 365*24*60*60*1000}}));

app
.get('/', function (req, res) {
    res.setHeader("Content-Type", "text/html");
    res.render('index', {});
})

// route to get static files
.use(express.static(__dirname + '/app'))

app.listen(1337, 'localhost');
console.log('HTTP Server running at http://localhost:1337/');