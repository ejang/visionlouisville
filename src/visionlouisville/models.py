from django.conf import settings
from django.db import models, IntegrityError, transaction
from django.utils.translation import ugettext as _
from django.contrib.auth.models import Group, AbstractUser

import logging
logger = logging.getLogger(__name__)


class User (AbstractUser):
    visible_on_home = models.BooleanField(default=True)

    def support(self, vision):
        vision.supporters.add(self)

    def unsupport(self, vision):
        vision.supporters.remove(self)

    def share(self, vision, share_id=None):
        share = Share(vision=vision, user=self, tweet_id=share_id)
        share.save()
        return share

    def unshare(self, vision):
        share = Share.objects.get(user=self, vision=vision)
        share.delete()

    def add_to_group(self, group_name):
        group = Group.objects.get(name=group_name)
        self.groups.add(group)

    def remove_from_group(self, group_name):
        group = Group.objects.get(name=group_name)
        self.groups.remove(group)


class Vision (models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    author = models.ForeignKey(User, related_name='visions')
    category = models.CharField(max_length=20, null=True, blank=True)
    text = models.TextField()
    featured = models.BooleanField(default=False)
    supporters = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='supported', blank=True)
    sharers = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='sharers', blank=True, through='Share')
    inspiration = models.ForeignKey('Moment', null=True, blank=True)

    tweet_id = models.CharField(max_length=64, null=True)

    class Meta:
        ordering = ('-created_at',)

    def __unicode__(self):
        return self.text[:140]


class Share (models.Model):
    vision = models.ForeignKey(Vision)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='shares')
    tweet_id = models.CharField(max_length=64, null=True)

    def __unicode__(self):
        return '%s shared "%s"' % (self.user, self.vision)


class MomentManager (models.Manager):
    def get_tweet_id(self, tweet):
        try:
            if isinstance(tweet, (int, str, unicode)):
                return int(tweet)
            else:
                return tweet['id']

        except (ValueError, TypeError, KeyError):
            raise ValueError(
                'Expected the numeric id of a tweet, or a dictionary-like '
                'object representing a tweet: %r'
                % tweet)

    def create_or_update_from_tweet(self, tweet):
        tweet_id = self.get_tweet_id(tweet)

        try:
            moment = Moment.objects.get(tweet_id=tweet_id)
            created = False
        except Moment.DoesNotExist:
            moment = Moment()
            created = True

        try:
            # TODO: Change to transaction.atomic when upgrading to Django 1.6
            with transaction.commit_on_success():
                moment.load_from_tweet(tweet)
        except IntegrityError:
            # Since we've already checked for moments with this tweet_id, we would
            # only have an integrity error at this point if some other thread or
            # process created a moment with the same tweet ID right before the
            # moment.save(). Since that's the case, just assume that we're ok with
            # that.
            pass

        return moment, created


class Moment (models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    tweet_id = models.CharField(
        max_length=64, null=True,
        help_text=(_(
            "You can fill in the tweet id and leave the other fields "
            "blank. For example, if the tweet URL is http://www.twitter.com/"
            "myuser/status/1234567890, then the tweet id is 1234567890.")))
    username = models.CharField(max_length=20, blank=True)
    text = models.TextField(blank=True)
    media_url = models.URLField(blank=True)

    objects = MomentManager()

    class Meta:
        ordering = ('-created_at',)

    def __unicode__(self):
        return '%s (%s)' % (self.text, self.media_url)

    def load_from_tweet(self, tweet, commit=True):
        if isinstance(tweet, (int, str, unicode)):
            from services import default_twitter_service as twitter_service
            t = twitter_service.get_api()
            tweet = t.statuses.show(id=tweet)

        self.text = tweet['text']
        self.tweet_id = tweet['id']
        self.username = tweet['user']['screen_name']
        for media in tweet['entities']['media']:
            if media['type'] == 'photo':
                self.media_url = media['media_url']
                break

        if commit:
            self.save()

    def save(self, *args, **kwargs):
        if self.tweet_id and not self.username and not self.text and not self.media_url:
            self.load_from_tweet(self.tweet_id, commit=False)
        return super(Moment, self).save(*args, **kwargs)


class Reply (models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    vision = models.ForeignKey(Vision, related_name='replies')
    author = models.ForeignKey(User, related_name='replies')
    text = models.CharField(max_length=140)

    tweet_id = models.CharField(max_length=64, null=True)

    class Meta:
        verbose_name_plural = 'replies'
        ordering = ('created_at',)

    def __unicode__(self):
        return '%s replied to "%s"' % (self.author, self.vision)
