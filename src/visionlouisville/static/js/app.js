/*globals Backbone Handlebars $ _ Swiper Modernizr */

var VisionLouisville = VisionLouisville || {};

(function(NS) {
  'use strict';

  // Helpers ==================================================================
  // Create a view and show it in a region only AFTER you get results back from
  // a collection.
  NS.showViewInRegion = function(collection, region, getView, options) {
    var render = function() {
      var view = getView(collection, options);
      region.show(view);
    };

    // Nothing in the collection? It's not done fetching. Let's wait for it.
    if (collection.size() === 0) {
      // Render when the collection resets
      collection.once('reset', function() {
        render();
      });
    } else {
      render();
    }
  };

  NS.scrollTops = {};
  // Router ===================================================================
  NS.Router = Backbone.Marionette.AppRouter.extend({
    appRoutes: {
      'visions/:category/new': 'newVision',
      'visions/:category/list': 'listVisions',
      'visions/new': 'newVision',
      'visions/list': 'listVisions',
      'visions/:id': 'showVision',
      'users/list': 'listUsers',
      'users/list/:id': 'listUsers',
      'users/:id/:tab': 'showUser',
      'users/:id': 'showUser',
      'ally': 'allySignup',
      '': 'home'
    },
    navigate: function(fragment, options) {
      var __super__ = Backbone.Marionette.AppRouter.prototype,
          path = NS.getCurrentPath();
      options = options || {};

      NS.scrollTops[path] = document.body.scrollTop || document.documentElement.scrollTop || 0;
      this.noscroll = options.noscroll;
      return __super__.navigate.call(this, fragment, options);
    }
  });

  NS.controller = {
    allySignup: function() {
      // TODO: Move to the config settings
      document.title = "#VizLou | Become an ally!";

      NS.app.mainRegion.show(new NS.AllySignupView({
        model: NS.app.currentUser
      }));
    },
    listVisions: function(listCategory) {
      // TODO: Move to the config settings
      document.title = "#VizLou | Explore visions" + (listCategory ? ' \u2014 ' + listCategory : '');

      var getVisionListView = function(collection, options) {
        var model;

        if (options.listCategory) {
          model = new Backbone.Model({category: options.listCategory});
          collection = new Backbone.Collection(
            collection.filter(function(model) {
              var category = model.get('category');
              return (!!category ? category : '').toLowerCase() === options.listCategory;
            }));
        } else {
          model = new Backbone.Model();
          collection = NS.app.visionCollection;
        }

        return new NS.VisionListView({
          model: model,
          collection: collection
        });
      };

      NS.showViewInRegion(NS.app.visionCollection, NS.app.mainRegion,
        getVisionListView, {listCategory: listCategory});
    },
    newVision: function(category, momentId) {
      // TODO: Move to the config settings
      document.title = "#VizLou | Add your vision";
      NS.Utils.log('send', 'event', 'vision', 'new');

      // Protect against unauthenticated users.
      if (!NS.app.currentUser.isAuthenticated()) {
        NS.app.router.navigate('/', { trigger: true });
        return;
      }

      NS.app.mainRegion.show(new NS.VisionFormView({
        category: category,
        collection: NS.app.visionCollection,
        model: new NS.VisionModel({
          category: category,
          inspiration: momentId,
          author: NS.app.currentUser.get('id')
        })
      }));
    },
    showVision: function(visionId) {
      // Set to an int
      visionId = parseInt(visionId, 10);

      var getVisionDetailView = function(collection, options) {
        var model = collection.get(options.visionId),
            layout = new NS.VisionDetailLayout({
              model: model
            });

        // TODO: Move to the config settings
        document.title = '#VizLou | "' + NS.Utils.truncateChars(model.get('text'), 70) + '" by @' + model.get('author_details').username;
        NS.Utils.log('send', 'event', 'vision', 'show', visionId);

        // TODO: why is this necessary?
        layout.on('show', function() {
          layout.replies.show(new NS.ReplyListView({
            model: model,
            collection: model.get('replies')
          }));

          layout.support.show(new NS.SupportListView({
            model: model,
            collection: model.get('supporters')
          }));
        });

        return layout;
      };

      NS.showViewInRegion(NS.app.visionCollection, NS.app.mainRegion,
        getVisionDetailView, {visionId: visionId});
    },
    home: function() {
      // TODO: Move to the config settings
      document.title = "#VizLou | What's your vision for the future of Louisville?";

      var homeView = new NS.HomeView({
            collection: NS.app.visionCollection
          }),

          getVisionCarouselView = function(collection) {
            var visionCarouselView = new NS.VisionCarouselView({
              collection: new NS.VisionCollection(
                collection.getFeatured()
              )
            });

            homeView.visionCarousel.on('show', function() {
              // Init the carousel after we're in the DOM
              visionCarouselView.initCarousel();
            });

            return visionCarouselView;
          },

          getVisionariesListView = function(collection) {
            var visionaries = collection.filter(function(model) {
                  return _.indexOf(model.get('groups'), 'allies') === -1;
                }).slice(0, 20);
            return new NS.UserAvatarListView({
              collection: new NS.UserCollection(visionaries),
              template: '#home-visionaries-tpl'
            });
          },

          getAlliesListView = function(collection) {
            var allies = collection.filter(function(model) {
                  return _.indexOf(model.get('groups'), 'allies') > -1;
                }).slice(0, 20);

            return new NS.UserAvatarListView({
              collection: new NS.UserCollection(allies),
              template: '#home-allies-tpl'
            });
          };

      // Render the main view
      NS.app.mainRegion.show(homeView);
      // Render the carousel
      NS.showViewInRegion(NS.app.visionCollection, homeView.visionCarousel, getVisionCarouselView);
      // Render visionaries
      NS.showViewInRegion(NS.app.userCollection, homeView.visionaries, getVisionariesListView);
      // Render allies
      NS.showViewInRegion(NS.app.userCollection, homeView.allies, getAlliesListView);
    },
    listUsers: function(id) {
      document.title = "#VizLou | See the " + NS.Utils.capitalize(id || 'visionaries');

      var userListLayout = new NS.UserListLayout({
            model: new Backbone.Model({show_allies: id === 'allies'})
          }),
          getUserListView = function(collection, options) {
            var filterUsers;

            if (options.id === 'allies') {
              filterUsers = function(model) { return _.indexOf(model.get('groups'), 'allies') > -1; };
            } else {
              filterUsers = function(model) { return _.indexOf(model.get('groups'), 'allies') === -1; };
            }

            return new NS.UserListWithFilterView({
              collection: new NS.UserCollection(collection.filter(filterUsers))
            });
          };

      NS.app.mainRegion.show(userListLayout);
      NS.showViewInRegion(NS.app.userCollection, userListLayout.userList, getUserListView, {id: id});
    },
    showUser: function(id, tab) {
      var getUserDetailView = function(collection, options) {
        var model = collection.get(options.id),
            view = new NS.UserDetailView({
              model: model
            }),
            isPersonal = (NS.app.currentUser.isAuthenticated() && id == NS.app.currentUser.id),
            logPrefix = isPersonal ? 'my-' : '',
            logSuffix = tab ? '-' + tab : '';

        document.title = "#VizLou | " + model.get('full_name') + "'s profile";

        view.on('show', function() {
          if (tab === 'supported') {
            view.showSupported();
          } else if (tab === 'replies') {
            view.showReplies();
          } else {
            view.showVisions();
          }
          NS.Utils.log('send', 'event', logPrefix + 'profile' + logSuffix, 'show', id + ' (' + model.get('username') + '/' + model.get('full_name') + ')');
        });

        return view;
      };
      NS.showViewInRegion(NS.app.userCollection, NS.app.mainRegion, getUserDetailView, {id: id});
    }
  };

  NS.getCurrentPath = function() {
    var root = Backbone.history.root,
        fragment = Backbone.history.fragment;
    return root + fragment;
  };

  NS.getLoginUrl = function(redirect) {
    if (!redirect) {
      redirect = NS.getCurrentPath();
    }
    return NS.loginURL + '?next=' + redirect;
  };

  // App ======================================================================
  NS.app = new Backbone.Marionette.Application();

  NS.app.addRegions({
    mainRegion: '.main'
  });

  NS.app.addInitializer(function(options){
    // Construct a new app router
    this.router = new NS.Router({
      controller: NS.controller
    });

    // Gobal-level events
    this.router.bind('route', function(route, router) {
      var path = NS.getCurrentPath(),
          scrollTop = NS.scrollTops[path] || 0;

      NS.Utils.log('send', 'pageview', NS.getCurrentPath());
      if (!this.noscroll) {
        document.body.scrollTop = document.documentElement.scrollTop = scrollTop;
      }
      $('.authentication-link-login').attr('href', NS.getLoginUrl());
      $('.user-menu').removeClass('is-open');
    });

    $('.user-menu-avatar').click(function(evt) {
      evt.preventDefault();
      $('.user-menu').toggleClass('is-open');
    });

    Backbone.history.start({ pushState: Modernizr.history, silent: true });
    if(!Modernizr.history) {
      var rootLength = Backbone.history.options.root.length,
          fragment = window.location.pathname.substr(rootLength),
          url;

      if (fragment) {
        Backbone.history.navigate(fragment, { trigger: true });
        url = window.location.protocol + '//' + window.location.host +
            Backbone.history.options.root + '#' + fragment;

        // Do a full redirect so we don't get urls like /visions/7#visions/7
        window.location = url;
      } else {
        Backbone.history.loadUrl(Backbone.history.getFragment());
      }
    } else {
      Backbone.history.loadUrl(Backbone.history.getFragment());
    }

    // Globally capture clicks. If they are internal and not in the pass
    // through list, route them through Backbone's navigate method.
    $(document).on("click", "a[href^='/']", function(evt) {
      var $link = $(evt.currentTarget),
          href = $link.attr('href'),
          noscroll = !_.isUndefined($link.attr('data-noscroll')),
          replace = !_.isUndefined($link.attr('data-replace')),
          url;

      // Allow shift+click for new tabs, etc.
      if ((href === '/' ||
           href.indexOf('/visions') === 0 ||
           href.indexOf('/users') === 0) &&
           !evt.altKey && !evt.ctrlKey && !evt.metaKey && !evt.shiftKey) {
        evt.preventDefault();

        if (href.indexOf('new') !== -1) {
          if (!NS.app.currentUser.isAuthenticated()) {
            window.alert('Sign in to create a new vision!');
            return;
          }
        }

        // Remove leading slashes and hash bangs (backward compatablility)
        url = href.replace(/^\//, '').replace('#!/', '');

        // # Instruct Backbone to trigger routing events
        NS.app.router.navigate(url, {
          trigger: true,
          noscroll: noscroll,
          replace: replace
        });

        return false;

      } else if (href.indexOf('/login') === 0) {
        NS.Utils.log('send', 'event', 'authentication', 'login');

      } else if (href.indexOf('/logout') === 0) {
        NS.Utils.log('send', 'event', 'authentication', 'logout');
      }

    });
  });

  // Init =====================================================================
  $(function() {
    NS.app.visionCollection = new NS.VisionCollection();
    NS.app.visionCollection.fetch({
      reset: true,
      cache: false
    });

    NS.app.userCollection = new NS.UserCollection();
    NS.app.userCollection.fetch({
      reset: true,
      cache: false,
      data: { visible_on_home: true }
    });

    NS.app.currentUser = new NS.UserModel(NS.currentUserData || {});

    // Set the appropriate authentication info for analytics
    var currentUserStatus;
    if (NS.app.currentUser.isAuthenticated()) {
      if (NS.app.currentUser.isInGroup('allies')) {
        currentUserStatus = 'ally';
      } else {
        currentUserStatus = 'visionary';
      }
    } else {
      currentUserStatus = 'anonymous';
    }
    NS.Utils.log('set', 'dimension1', currentUserStatus);

    NS.app.start({
      visionCollection: NS.app.visionCollection
    });
  });

}(VisionLouisville));