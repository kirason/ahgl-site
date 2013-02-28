import posixpath
import urllib2
import logging

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import models
from django.utils.translation import ugettext_lazy as _
from django.conf import settings
from django.utils.safestring import mark_safe
from django.template.defaultfilters import escape
from django.dispatch import receiver
from django.db.models.signals import post_save
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.template.defaultfilters import slugify

from social_auth.signals import socialauth_registered
from social_auth.backends.facebook import FacebookBackend
from social_auth.backends.pipeline import USERNAME

from idios.utils import get_profile_form
from account.models import EmailAddress, Account
from timezones.utils import coerce_timezone_value
from pybb.models import PybbProfile
if "sorl.thumbnail" in settings.INSTALLED_APPS:
    from sorl.thumbnail import ImageField
else:
    from django.db.models import ImageField

from . import RACES
from .fields import HTMLField
from apps.tournaments.models import Game

logger = logging.getLogger(__name__)

class Profile(PybbProfile):
    user = models.ForeignKey(User, verbose_name=_("user"), related_name="profile")
    name = models.CharField(_("name"), max_length=50)
    slug = models.SlugField(max_length=50, editable=False, unique=True) # TODO: make autogenerated slug field that points to the field it gets its sluggification from
    photo = ImageField(upload_to='profile_photos', null=True, blank=True, help_text=u"Must be 352 x 450 pixels")
    custom_thumb = ImageField(upload_to='profile_custom_thumb_photos', null=True, blank=True, help_text=u"Must be 150 x 170 pixels")
    #about = models.TextField(_("about"), null=True, blank=True)
    #location = models.CharField(_("location"), max_length=40, null=True, blank=True)
    website = models.URLField(_("website"), null=True, blank=True, verify_exists=False)

    #company data
    title = models.CharField(max_length=70, blank=True)
    
    @property
    def avatar(self):
        return self.thumbnail()
    
    @property
    def thumbnail(self):
        return self.custom_thumb or self.photo
    
    @property
    def profile_slug(self):
        return self.slug

    def is_active(self, tournament=None): #TODO: make this check if they are active in that particular tournament
        return self.user.is_superuser or self.teams.filter(tournament__status='A').count() > 0
    
    def is_captain(self):
        return self.team_membership.filter(captain=True, team__tournament__status='A').count() > 0
    
    def active_teams(self):
        return self.teams.filter(tournament__status='A').select_related('tournament')
    
    def memberships(self):
        return self.team_membership.select_related('team__tournament')

    @property
    def wins(self):
        return Game.objects.filter(winner__profile=self, match__published=True).count()
    @property
    def losses(self):
        return Game.objects.filter(loser__profile=self, match__published=True).count()
    
    def __unicode__(self):
        return self.name or self.user.username
    
    @models.permalink
    def get_absolute_url(self, group=None):
        return ('profile_detail', (), {'slug': self.slug,
                                       }
                )

    @classmethod
    def get_form(cls):
        return get_profile_form(cls)

    def save(self, *args, **kwargs):
        """
        Based on the Tag save() method in django-taggit, this method simply
        stores a slugified version of the title, ensuring that the unique
        constraint is observed
        """
        if self.id is None:
            self.slug = slug = slugify(self.name or self.user.username)
            i = 0
            while True:
                try:
                    savepoint = transaction.savepoint()
                    res = super(Profile, self).save(*args, **kwargs)
                    transaction.savepoint_commit(savepoint)
                    return res
                except IntegrityError:
                    transaction.savepoint_rollback(savepoint)
                    i += 1
                    self.slug = '%s_%d' % (slug, i)
        else:
            return super(Profile, self).save(*args, **kwargs)

class TeamMembership(models.Model):
    """All team specific profile data goes here"""
    #M2M data
    team = models.ForeignKey('Team', db_index=True, related_name='team_membership')
    profile = models.ForeignKey('Profile', db_index=True, related_name='team_membership')

    #team specific profile data
    char_name = models.CharField(max_length=20)
    active = models.BooleanField(default=True)
    captain = models.BooleanField(default=False)
    questions_answers = HTMLField(tags=['ol','ul','li', 'strong', 'em', 'p'], blank=True, default="""<ol><li>
<p>Why did you choose this race/champion?</p>
<p>-</p>
</li>
<li>
<p>What do you do for a living?  What do you love about your job?</p>
<p>-</p>
</li>
<li>
<p>What other hobbies do you have?</p>
<p>-</p>
</li>
<li>
<p>Why do you play StarCraft/League of Legends?</p>
<p>-</p>
</li>
<li>
<p>How long have you been playing?</p>
<p>-</p>
</li>
<li>
<p>What have you done to prepare for the momentous challenge that is the AHGL Tournament?</p>
<p>-</p>
</li>
<li>
<p>Why is your team going to win?</p>
<p>-</p>
</li>
<li>
<p>Who is the best player on your team?  Why?</p>
<p>-</p>
</li>
<li>
<p>Whom do you fear most amongst the competition and why?</p>
<p>-</p>
</li>
<li>
<p>What is your Heart of the Swarm beta character code and ID?</p>
<p>-</p>
</li>
</ol>""")
    game_profile = models.URLField(null=True, blank=True)
    
    #starcraft data
    char_code = models.PositiveSmallIntegerField(null=True, blank=True)
    race = models.CharField(max_length=1, choices=RACES, null=True, blank=True)
    
    #league of legends data
    champion = models.CharField(max_length=60, blank=True)

    @classmethod
    def get(self, team, tournament, profile):
        return TeamMembership.objects.select_related('team', 'profile') \
                                     .filter(team__slug=team,
                                             team__tournament=tournament,
                                             profile__slug=profile)

    @property
    def photo(self):
        return self.profile.photo
    @property
    def thumbnail(self):
        return self.profile.thumbnail
    @property
    def wins(self):
        return self.game_wins.filter(match__published=True).count()
    @property
    def losses(self):
        return self.game_losses.filter(match__published=True).count()

    @models.permalink
    def get_absolute_url(self, group=None):
        return ('player_profile', (), {'tournament': self.team.tournament_id,
                                       'team': self.team.slug,
                                       'profile': self.profile.slug,
                                       }
                )

    def __unicode__(self):
        return self.char_name

    class Meta:
        db_table = 'profiles_team_members'
        unique_together = (('team', 'profile'),)
        ordering = ('-active', '-captain', 'char_name',)

class Team(models.Model):
    """Per Tournament"""
    name = models.CharField(_("company name"), max_length=50)
    slug = models.SlugField(_("slug"), max_length=50)
    photo = ImageField(_("team photo"), upload_to='team_photos', null=True, blank=True, help_text=u"Must be 920px x 450px")
    charity = models.ForeignKey('profiles.Charity', null=True, blank=True, on_delete=models.SET_NULL, related_name='teams', help_text=u"If your charity is not listed, send a message to an admin for it to be added.")
    motto = models.CharField(_("team motto"), max_length=70, blank=True)
    approval = models.FileField(_("Written Company Permission"), upload_to='team_approvals', null=True, blank=True, help_text="Submit a pdf of approval letter on official company letterhead saying that your team can represent your company in the AHGL (if needed an approval email from an official company email will do).")
    members = models.ManyToManyField('Profile', null=True, blank=True, related_name='teams', through=TeamMembership)
    tournament = models.ForeignKey('tournaments.Tournament', related_name='teams', db_index=True)
    karma = models.IntegerField(default=0)
    
    wins = models.IntegerField(default=0, editable=False)
    losses = models.IntegerField(default=0, editable=False)
    tiebreaker = models.IntegerField(default=0, editable=False)
    
    seed = models.IntegerField(default=0)
    
    status = models.CharField(max_length=1, choices=(('R', 'Registering'),('W', 'Awaiting Approval'), ('A', 'Accepted'),('F', 'Finalized')), default='R')
    paid = models.BooleanField(default=False)
    
    def update_stats(self):
        self.wins = self.match_wins.filter(published=True).count()
        self.losses = self.match_losses.filter(published=True).count()
        self.tiebreaker = self.game_wins.filter(match__published=True).count() - self.game_losses.filter(match__published=True).count()
        self.save()

    @property
    def thumbnail(self):
        return self.photo
    
    @property
    def membership_queryset(self):
        self._team_membership_queryset = getattr(self, '_team_membership_queryset', None) or self.team_membership.select_related('profile').extra(select={'lower_char_name': 'lower(char_name)'}).order_by('-active', '-captain', 'lower_char_name')
        return self._team_membership_queryset        
    @property
    def captains(self):
        return [membership for membership in self.membership_queryset if membership.captain]
    
    def __unicode__(self):
        return u" : ".join((self.name, self.tournament.name))
    
    @models.permalink
    def get_absolute_url(self):
        return ('team_page', (), {'tournament': self.tournament_id,
                                  'slug': self.slug,
                                  }
                )
    
    class Meta:
        unique_together = (('name','tournament'),('slug', 'tournament'),)
        ordering = ('name',)

class Charity(models.Model):
    name = models.CharField(_("name"), max_length=60)
    desc = models.TextField(blank=True)
    link = models.URLField(blank=True)
    logo = ImageField(upload_to='charity_logos', null=True, blank=True)
    
    def __unicode__(self):
        return self.name
    
    class Meta:
        ordering = ('name',)
        verbose_name_plural = "charities"

@receiver(socialauth_registered, sender=FacebookBackend, dispatch_uid="tournaments_facebook_extra_values")
def facebook_extra_values(sender, user, response, details, **kwargs):
    for name, value in details.iteritems():
        # do not update username, it was already generated
        if name == USERNAME:
            continue
        if value and value != getattr(user, name, None):
            setattr(user, name, value)
    
    profile = user.get_profile()
    profile.name = response.get('name')
    if not profile.photo:
        url = 'http://graph.facebook.com/%s/picture?type=large' % response.get('id')
        try:
            content = urllib2.urlopen(url)
            # Facebook default image check
            if sender.name == 'facebook' and 'image/gif' in str(content.info()):
                return
     
            filename = user.username + "_profile" + '.' + content.headers.subtype
            profile.photo.save(filename, ContentFile(content.read()))
        except IOError, e:
            logger.debug(e)
    try:
        profile.language = response.get('locale').split("_")[0]
        profile.full_clean()
    except Exception:
        pass
    profile.time_zone = response.get('timezone')
    profile.save()
    account = user.account_set.all()[0] or Account.create(user=user, create_email=False)
    try:
        account.language = response.get('locale').split("_")[0]
        tz_offset = int(response.get('timezone'))
        tz_joiner = "" if tz_offset < 0 else "+"
        account.timezone = coerce_timezone_value(tz_joiner.join(("Etc/GMT",str(tz_offset))))
        account.full_clean()
    except Exception:
        pass
    account.save()
    email, created = EmailAddress.objects.get_or_create(user=user, email=user.email)
    email.verified = True
    email.save()
    return True
